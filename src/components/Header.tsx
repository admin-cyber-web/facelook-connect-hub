import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bell,
  Search,
  X,
  UserPlus,
  Home,
  Settings,
  Loader2,
  Heart,
  Users,
  FileText,
  MessageCircle,
  UserCheck,
  UserX,
  CheckCheck,
  AtSign,
  Check,
  Link2,
  Flame,
  Zap,
  MapPin,
  BookOpen,
  Phone,
  Flag,
  ShieldCheck,
  Trash2,
  Share2,
  Reply,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useProfileViewer } from "@/context/ProfileViewerContext";

// ── Types ───────────────────────────────────────────────────────────────────────
interface FriendEntry {
  friendshipId: string;
  id: string;
  full_name: string;
  avatar_url?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
// ── Facebook-style relative timestamp: "now", "2m ago", "1h ago", "3d ago", "2w ago" ──
function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 30) return "now";
  const m = Math.floor(s / 60);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

const NOTIF_META: Record<
  string,
  { icon: React.ReactNode; color: string; label: string }
> = {
  like: {
    icon: <Heart size={13} fill="currentColor" />,
    color: "bg-red-500/20 text-red-400",
    label: "liked your post.",
  },
  like_flick: {
    icon: <Heart size={13} fill="currentColor" />,
    color: "bg-red-500/20 text-red-400",
    label: "liked your flick.",
  },
  comment: {
    icon: <MessageCircle size={13} />,
    color: "bg-green-500/20 text-green-400",
    label: "commented on your post.",
  },
  follow: {
    icon: <UserPlus size={13} />,
    color: "bg-purple-500/20 text-purple-400",
    label: "started following you.",
  },
  friend_request: {
    icon: <UserPlus size={13} />,
    color: "bg-blue-500/20 text-blue-400",
    label: "sent you a friend request.",
  },
  friend_accepted: {
    icon: <UserCheck size={13} />,
    color: "bg-teal-500/20 text-teal-400",
    label: "accepted your friend request.",
  },
  circle_join: {
    icon: <Users size={13} />,
    color: "bg-yellow-500/20 text-yellow-400",
    label: "joined your circle.",
  },
  circle_invite: {
    icon: <Users size={13} />,
    color: "bg-yellow-500/20 text-yellow-400",
    label: "invited you to a circle.",
  },
  new_post: {
    icon: <FileText size={13} />,
    color: "bg-gray-500/20 text-gray-400",
    label: "shared a new post.",
  },
  mention: {
    icon: <AtSign size={13} />,
    color: "bg-orange-500/20 text-orange-400",
    label: "mentioned you in a post.",
  },
  post_mention: {
    icon: <AtSign size={13} />,
    color: "bg-orange-500/20 text-orange-400",
    label: "mentioned you in a post.",
  },
  post_pin: {
    icon: <AtSign size={13} />,
    color: "bg-amber-500/20 text-amber-400",
    label: "pinned you in a priority post.",
  },
  story_view: {
    icon: <FileText size={13} />,
    color: "bg-indigo-500/20 text-indigo-400",
    label: "viewed your story.",
  },
  story_like: {
    icon: <Heart size={13} fill="currentColor" />,
    color: "bg-pink-500/20 text-pink-400",
    label: "liked your story.",
  },
  report_submitted: {
    icon: <Flag size={13} />,
    color: "bg-orange-500/20 text-orange-400",
    label: "Your report is under review.",
  },
  report_resolved_safe: {
    icon: <ShieldCheck size={13} />,
    color: "bg-green-500/20 text-green-400",
    label: "Review complete. Content follows community guidelines.",
  },
  report_resolved_removed: {
    icon: <Trash2 size={13} />,
    color: "bg-emerald-500/20 text-emerald-400",
    label: "Your report was actioned. The content was removed.",
  },
  report_post_removed: {
    icon: <Trash2 size={13} />,
    color: "bg-red-500/20 text-red-400",
    label: "Your post was reviewed and removed after a report.",
  },
  circle_post_approved: {
    icon: <CheckCheck size={13} />,
    color: "bg-green-500/20 text-green-400",
    label: "Your Circle post was approved and is now live! ✅",
  },
  circle_post_rejected: {
    icon: <UserX size={13} />,
    color: "bg-red-500/20 text-red-400",
    label: "Your Circle post was reviewed and not approved. ❌",
  },
  share: {
    icon: <Share2 size={13} />,
    color: "bg-sky-500/20 text-sky-400",
    label: "shared your post.",
  },
  circle_share: {
    icon: <Share2 size={13} />,
    color: "bg-yellow-500/20 text-yellow-400",
    label: "shared your circle post.",
  },
  hook_share: {
    icon: <Share2 size={13} />,
    color: "bg-orange-500/20 text-orange-400",
    label: "shared your hook post.",
  },
  reply: {
    icon: <Reply size={13} />,
    color: "bg-indigo-500/20 text-indigo-400",
    label: "replied to your comment.",
  },
  magnet_link: {
    icon: <Zap size={13} />,
    color: "bg-teal-500/20 text-teal-400",
    label: "sent you a viral Link!",
  },
  magnet_accepted: {
    icon: <Zap size={13} />,
    color: "bg-emerald-500/20 text-emerald-400",
    label: "joined your viral chain.",
  },
  magnet: {
    icon: <Zap size={13} />,
    color: "bg-teal-500/20 text-teal-400",
    label: "sent you a link.",
  },
};

// ── Extract quoted comment text from content (handles both new "comment" and old hindi "ne ... \"text\"") ──
function extractCommentQuote(content?: string | null): string {
  if (!content) return "";
  const m = content.match(/"([^"]+)"/);
  if (m) return m[1].trim();
  // New format stores raw comment text — strip any legacy hindi prefix
  const cleaned = content
    .replace(
      /^.*?(comment kiya|comment kia|react kiya|like ki|like kiya|bheji|accept ki|mention kiya|join hua)[: ]*/i,
      "",
    )
    .trim();
  return cleaned;
}

// ── Parse rich share payload from JSON-encoded notification content ──
function parseRichShare(
  content?: string | null,
): {
  thumbnail_url?: string;
  share_title?: string;
  share_description?: string;
  text?: string;
} | null {
  if (!content || !content.trim().startsWith("{")) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// ── Format the action text shown after the actor's bold name ──
function formatNotifAction(
  type: string,
  content?: string | null,
): { text: string; quote?: string } {
  const meta = NOTIF_META[type];
  if (type === "comment" || type === "reply") {
    const q = extractCommentQuote(content);
    return {
      text:
        type === "reply"
          ? "replied to your comment:"
          : "commented on your post:",
      quote: q,
    };
  }
  if (["share", "circle_share", "hook_share"].includes(type)) {
    const rich = parseRichShare(content);
    return { text: rich?.text ?? meta?.label ?? "shared your content." };
  }
  if (meta) return { text: meta.label };
  // Fallback: try to clean any legacy hindi content
  return {
    text: content?.replace(/^ne\s+/i, "").trim() || "sent you a notification.",
  };
}

// ── Group consecutive notifications of same (type + entity_id) → "A, B and N others ..." ──
type Notif = any;
function groupNotifications(
  list: Notif[],
): Array<Notif & { _group?: Notif[] }> {
  const groupable = new Set([
    "like",
    "like_flick",
    "story_view",
    "story_like",
    "follow",
  ]);
  const out: Array<Notif & { _group?: Notif[] }> = [];
  let i = 0;
  while (i < list.length) {
    const cur = list[i];
    if (!groupable.has(cur.type) || !cur.entity_id) {
      out.push(cur);
      i++;
      continue;
    }
    const bucket: Notif[] = [cur];
    let j = i + 1;
    while (
      j < list.length &&
      list[j].type === cur.type &&
      list[j].entity_id === cur.entity_id
    ) {
      bucket.push(list[j]);
      j++;
    }
    if (bucket.length === 1) {
      out.push(cur);
    } else {
      out.push({ ...cur, _group: bucket });
    }
    i = j;
  }
  return out;
}

// ── Scramble config ────────────────────────────────────────────────────────────
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#@!%&$";
const WORD = ["F", "l", "i", "c", "k", "s"] as const;
const SCRAMBLE_STEPS = 10;
const STEP_MS = 50;
const STAGGER_MS = 75;

const FlicksLogo = () => {
  const [letters, setLetters] = useState<string[]>(() =>
    WORD.map(() => CHARS[Math.floor(Math.random() * CHARS.length)]),
  );
  const [showBullet, setShowBullet] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    WORD.forEach((finalChar, idx) => {
      const start = idx * STAGGER_MS;
      for (let step = 0; step <= SCRAMBLE_STEPS; step++) {
        const t = setTimeout(
          () => {
            setLetters((prev) => {
              const next = [...prev];
              next[idx] =
                step === SCRAMBLE_STEPS
                  ? finalChar
                  : CHARS[Math.floor(Math.random() * CHARS.length)];
              return next;
            });
            if (idx === WORD.length - 1 && step === SCRAMBLE_STEPS) {
              setTimeout(() => {
                setShowBullet(true);
                setTimeout(() => setShowBullet(false), 700);
              }, 40);
            }
          },
          start + step * STEP_MS,
        );
        timers.push(t);
      }
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="relative flex flex-col items-start select-none leading-none">
      <div className="relative flex items-baseline gap-0">
        {WORD.map((_, i) => (
          <span
            key={i}
            className="text-[18px] sm:text-[20px] font-black tracking-tight tabular-nums"
            style={{
              color: i < 4 ? "#ffffff" : "#60a5fa",
              textShadow:
                i < 4
                  ? "0 0 10px rgba(255,255,255,0.18)"
                  : "0 0 10px rgba(96,165,250,0.45)",
              minWidth: "0.55em",
              display: "inline-block",
              textAlign: "center",
            }}
          >
            {letters[i]}
          </span>
        ))}
        <AnimatePresence>
          {showBullet && (
            <motion.div
              key="bullet"
              initial={{ scaleX: 0, opacity: 1 }}
              animate={{ scaleX: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
              className="absolute left-0 right-0 pointer-events-none"
              style={{
                top: "50%",
                height: "2px",
                transformOrigin: "left center",
                background:
                  "linear-gradient(90deg, transparent 0%, #60a5fa 30%, #ffffff 50%, #60a5fa 70%, transparent 100%)",
                boxShadow: "0 0 8px 2px rgba(96,165,250,0.7)",
              }}
            />
          )}
        </AnimatePresence>
      </div>
      <p className="text-[7px] sm:text-[8px] font-black tracking-[0.22em] text-white/40 uppercase mt-0.5">
        Made in India
      </p>
    </div>
  );
};

const TirangaFlag = () => (
  <motion.span
    animate={{ rotate: [0, -5, 5, -3, 3, -1, 1, 0] }}
    transition={{
      duration: 1.8,
      repeat: Infinity,
      repeatDelay: 1.2,
      ease: "easeInOut",
    }}
    style={{
      display: "inline-block",
      transformOrigin: "50% 100%",
      fontSize: "20px",
      lineHeight: 1,
    }}
    className="select-none"
  >
    🇮🇳
  </motion.span>
);

const CIRCLE_GRADS = [
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
];
function circleGrad(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h) ^ id.charCodeAt(i);
  return CIRCLE_GRADS[Math.abs(h) % CIRCLE_GRADS.length];
}

// ── Relevance scorer: exact=3, starts-with=2, contains=1, no-match=0 ──────────
function scoreRelevance(name: string, q: string): number {
  const n = (name || "").toLowerCase();
  const s = q.toLowerCase();
  if (n === s) return 3;
  if (n.startsWith(s)) return 2;
  if (n.includes(s)) return 1;
  return 0;
}
function sortByRelevance<T extends { full_name?: string; name?: string }>(
  items: T[],
  q: string,
): T[] {
  return [...items].sort((a, b) => {
    const nameA = a.full_name || a.name || "";
    const nameB = b.full_name || b.name || "";
    return scoreRelevance(nameB, q) - scoreRelevance(nameA, q);
  });
}

// ── Search Modal ───────────────────────────────────────────────────────────────
const SearchModal = ({
  onClose,
  userId,
}: {
  onClose: () => void;
  userId?: string;
}) => {
  const { openProfile } = useProfileViewer();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [people, setPeople] = useState<any[]>([]);
  const [circles, setCircles] = useState<any[]>([]);
  const [hooks, setHooks] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [sugPeople, setSugPeople] = useState<any[]>([]);
  const [sugCircles, setSugCircles] = useState<any[]>([]);
  const [sugHooks, setSugHooks] = useState<any[]>([]);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [personPosts, setPersonPosts] = useState<Record<string, any>>({});
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [viewingPost, setViewingPost] = useState<any | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
    (async () => {
      const queries: Promise<any>[] = [
        supabase
          .from("profiles")
          .select("id,full_name,avatar_url,fame_points,last_seen")
          .eq("profile_hidden", false)
          .eq("is_private_mode", false)
          .order("fame_points", { ascending: false })
          .limit(8)
          .then((r) =>
            r.error?.code === "42703"
              ? supabase
                  .from("profiles")
                  .select("id,full_name,avatar_url,last_seen")
                  .eq("profile_hidden", false)
                  .limit(8)
              : r,
          ),
        supabase
          .from("groups")
          .select("id,name,cover_url,member_count")
          .order("member_count", { ascending: false })
          .limit(8),
        supabase
          .from("hook_pages")
          .select("id,name,cover_url,hook_count,category")
          .order("hook_count", { ascending: false })
          .limit(8),
      ];
      if (userId)
        queries.push(
          supabase
            .from("friend_requests")
            .select("receiver_id")
            .eq("sender_id", userId),
        );
      const [{ data: p }, { data: c }, { data: hp }, reqRes] =
        await Promise.all(queries);
      setSugPeople(
        ((p || []) as any[])
          .filter((x: any) => x.id !== userId)
          .map((x: any) => ({ ...x, fame_points: x.fame_points ?? 0 })),
      );
      setSugCircles(c || []);
      setSugHooks(hp || []);
      if (reqRes?.data)
        setSentRequests(new Set(reqRes.data.map((r: any) => r.receiver_id)));
    })();
  }, [userId]);

  const handleAddFriend = async (e: React.MouseEvent, personId: string) => {
    e.stopPropagation();
    if (!userId || sentRequests.has(personId)) return;
    setSentRequests((prev) => new Set([...prev, personId]));
    const { error } = await supabase
      .from("friendships")
      .insert({ sender_id: userId, receiver_id: personId, status: "pending" });
    if (error) {
      if (
        !error.message?.includes("duplicate") &&
        !error.message?.includes("unique")
      ) {
        setSentRequests((prev) => {
          const n = new Set(prev);
          n.delete(personId);
          return n;
        });
        toast.error("Friend request nahi bheji ja saki.");
      }
      return;
    }
    await supabase
      .from("notifications")
      .insert({
        notifier_id: personId,
        actor_id: userId,
        type: "friend_request",
        entity_id: personId,
        content: "sent you a friend request",
        is_read: false,
      });
  };

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setPeople([]);
        setCircles([]);
        setHooks([]);
        setPosts([]);
        setPersonPosts({});
        return;
      }
      setLoading(true);
      const like = `%${q.trim()}%`;
      const [{ data: p }, { data: c }, { data: hp }, { data: ps }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id,full_name,avatar_url,fame_points,last_seen")
            .ilike("full_name", like)
            .eq("profile_hidden", false)
            .eq("is_private_mode", false)
            .limit(10),
          supabase
            .from("groups")
            .select("id,name,cover_url,member_count,privacy")
            .ilike("name", like)
            .limit(8),
          supabase
            .from("hook_pages")
            .select("id,name,cover_url,hook_count,category")
            .ilike("name", like)
            .limit(8),
          supabase
            .from("posts")
            .select("id,content,author,media_url,media_type,likes_count")
            .ilike("content", like)
            .limit(6),
        ]);
      const foundPeople = sortByRelevance(
        (p || []).filter((x: any) => x.id !== userId),
        q,
      );
      setPeople(foundPeople);
      setCircles(sortByRelevance(c || [], q));
      setHooks(sortByRelevance(hp || [], q));
      setPosts(ps || []);

      // fetch latest post for each found person
      if (foundPeople.length > 0) {
        const postMap: Record<string, any> = {};
        await Promise.all(
          foundPeople.map(async (person: any) => {
            const { data: post } = await supabase
              .from("posts")
              .select("id,content,media_url,media_type,likes_count,created_at")
              .eq("author_id", person.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (post) postMap[person.id] = post;
          }),
        );
        setPersonPosts(postMap);

        // pre-fetch which posts current user has liked
        if (userId) {
          const postIds = Object.values(postMap).map((pt: any) => pt.id);
          if (postIds.length > 0) {
            const { data: liked } = await supabase
              .from("post_likes")
              .select("post_id")
              .eq("user_id", userId)
              .in("post_id", postIds);
            if (liked) setLikedPosts(new Set(liked.map((l: any) => l.post_id)));
          }
        }
      }

      setLoading(false);
    },
    [userId],
  );

  const handleLikePost = async (e: React.MouseEvent, post: any) => {
    e.stopPropagation();
    if (!userId) return;
    const postId = post.id;
    const isLiked = likedPosts.has(postId);
    // optimistic toggle
    setLikedPosts((prev) => {
      const n = new Set(prev);
      isLiked ? n.delete(postId) : n.add(postId);
      return n;
    });
    setPersonPosts((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((uid) => {
        if (updated[uid]?.id === postId)
          updated[uid] = {
            ...updated[uid],
            likes_count: (updated[uid].likes_count || 0) + (isLiked ? -1 : 1),
          };
      });
      return updated;
    });
    if (isLiked) {
      await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId);
    } else {
      await supabase
        .from("post_likes")
        .insert({ post_id: postId, user_id: userId });
    }
  };

  useEffect(() => {
    const t = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  const isSearching = query.trim().length > 0;
  const noResults =
    isSearching &&
    !loading &&
    people.length + circles.length + hooks.length + posts.length === 0;

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const AddBtn = ({ id }: { id: string }) => (
    <button
      onClick={(e) => handleAddFriend(e, id)}
      disabled={sentRequests.has(id)}
      className={`px-4 py-2.5 rounded-xl text-sm font-extrabold active:scale-95 transition-all shrink-0 ${sentRequests.has(id) ? "bg-white/10 text-white/40" : "text-white shadow-lg"}`}
      style={
        sentRequests.has(id)
          ? {}
          : {
              background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
              boxShadow: "0 4px 14px rgba(79,70,229,0.5)",
            }
      }
    >
      {sentRequests.has(id) ? "Requested" : "+ Add Friend"}
    </button>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="fixed inset-0 z-[200] flex flex-col"
      style={{
        background: "rgba(10,14,28,0.97)",
        backdropFilter: "blur(24px)",
      }}
    >
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/5">
        <Search size={18} className="text-blue-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search people, circles, posts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-white text-[15px] font-semibold outline-none placeholder:text-white/25"
        />
        {loading && (
          <Loader2 size={16} className="text-blue-400 animate-spin shrink-0" />
        )}
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-white/10 rounded-xl text-white/50 hover:text-white transition-all shrink-0"
        >
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto pb-10">
        {noResults && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-white/20">
            <Search size={40} strokeWidth={1.5} />
            <p className="text-[11px] font-black uppercase tracking-widest">
              No results for "{query}"
            </p>
          </div>
        )}
        {isSearching && !noResults && (
          <>
            {people.length > 0 && (
              <div className="pt-5">
                <div className="flex items-center gap-2 px-4 mb-3">
                  <Users size={12} className="text-blue-400" />
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                    People
                  </p>
                </div>
                {people.map((person) => {
                  const latestPost = personPosts[person.id];
                  const isImg =
                    latestPost?.media_url &&
                    !/\.(mp4|webm|ogg|mov)/i.test(
                      latestPost.media_url.split("?")[0],
                    );
                  const isVid =
                    latestPost?.media_url &&
                    /\.(mp4|webm|ogg|mov)/i.test(
                      latestPost.media_url.split("?")[0],
                    );
                  const postLiked = latestPost && likedPosts.has(latestPost.id);
                  return (
                    <div key={person.id} className="border-b border-white/5">
                      {/* ── Person row ── */}
                      <div
                        className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer"
                        onClick={() => {
                          openProfile(person.id);
                          onClose();
                        }}
                      >
                        <div className="relative shrink-0">
                          <div className="w-11 h-11 rounded-full bg-blue-600 overflow-hidden border border-white/10">
                            {person.avatar_url ? (
                              <img
                                src={person.avatar_url}
                                className="w-full h-full object-cover"
                                alt=""
                                decoding="async"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white font-black text-sm">
                                {person.full_name?.[0]}
                              </div>
                            )}
                          </div>
                          {(() => {
                            const online =
                              person.last_seen &&
                              Date.now() -
                                new Date(person.last_seen).getTime() <
                                5 * 60 * 1000;
                            return online ? (
                              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-[#0f172a]" />
                            ) : null;
                          })()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold text-[13px] truncate">
                            {person.full_name}
                          </p>
                          {(person.fame_points || 0) > 0 && (
                            <p className="text-yellow-400/60 text-[10px]">
                              ⭐ {person.fame_points} fame
                            </p>
                          )}
                        </div>
                        <AddBtn id={person.id} />
                      </div>
                      {/* ── Latest post preview ── */}
                      {latestPost && (
                        <div
                          className="mx-4 mb-3 rounded-2xl overflow-hidden border border-white/10 cursor-pointer active:opacity-80 transition-opacity"
                          style={{ background: "rgba(255,255,255,0.04)" }}
                          onClick={() =>
                            setViewingPost({
                              ...latestPost,
                              author_name: person.full_name,
                              author_avatar: person.avatar_url,
                            })
                          }
                        >
                          {/* media */}
                          {isImg && (
                            <img
                              src={latestPost.media_url}
                              className="w-full max-h-44 object-cover"
                              loading="lazy"
                              alt=""
                              decoding="async"
                            />
                          )}
                          {isVid && (
                            <video
                              src={latestPost.media_url}
                              className="w-full max-h-44 object-cover"
                              muted
                              playsInline
                              preload="metadata"
                            />
                          )}
                          <div className="px-3 py-2 flex items-center gap-2">
                            {latestPost.content && (
                              <p className="flex-1 text-white/70 text-[12px] leading-snug line-clamp-2">
                                {latestPost.content}
                              </p>
                            )}
                            {!latestPost.content && <div className="flex-1" />}
                            {/* Like button */}
                            <button
                              onClick={(e) => handleLikePost(e, latestPost)}
                              className="flex items-center gap-1 shrink-0 px-2.5 py-1.5 rounded-xl transition-all active:scale-90"
                              style={{
                                background: postLiked
                                  ? "rgba(239,68,68,0.15)"
                                  : "rgba(255,255,255,0.06)",
                              }}
                            >
                              <Heart
                                size={13}
                                fill={postLiked ? "#ef4444" : "none"}
                                className={
                                  postLiked ? "text-red-400" : "text-white/40"
                                }
                              />
                              <span
                                className={`text-[11px] font-bold ${postLiked ? "text-red-400" : "text-white/40"}`}
                              >
                                {latestPost.likes_count || 0}
                              </span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {circles.length > 0 && (
              <div className="pt-5">
                <div className="flex items-center gap-2 px-4 mb-3">
                  <Users size={12} className="text-purple-400" />
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                    Circles
                  </p>
                </div>
                {circles.map((circle) => (
                  <div
                    key={circle.id}
                    className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <div
                      className="w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-white/10"
                      style={{ background: circleGrad(circle.id) }}
                    >
                      {circle.cover_url && (
                        <img
                          src={circle.cover_url}
                          className="w-full h-full object-cover"
                          alt=""
                          decoding="async"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-[13px] truncate">
                        {circle.name}
                      </p>
                      <p className="text-white/40 text-[10px]">
                        {circle.member_count ?? 0} members ·{" "}
                        {circle.privacy || "public"}
                      </p>
                    </div>
                    <button className="px-3 py-1.5 bg-purple-600 rounded-xl text-[10px] font-black text-white active:scale-95 transition-transform shrink-0">
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}
            {hooks.length > 0 && (
              <div className="pt-5">
                <div className="flex items-center gap-2 px-4 mb-3">
                  <span className="text-[12px]">🪝</span>
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                    Hooks
                  </p>
                </div>
                {hooks.map((hook) => (
                  <div
                    key={hook.id}
                    className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <div
                      className="w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-white/10"
                      style={{
                        background: "linear-gradient(135deg,#f59e0b,#ef4444)",
                      }}
                    >
                      {hook.cover_url && (
                        <img
                          src={hook.cover_url}
                          className="w-full h-full object-cover"
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-[13px] truncate">
                        {hook.name}
                      </p>
                      <p className="text-white/40 text-[10px]">
                        {hook.hook_count ?? 0} hooks
                        {hook.category ? ` · ${hook.category}` : ""}
                      </p>
                    </div>
                    <span className="text-[10px] font-black text-amber-400/70 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
                      View
                    </span>
                  </div>
                ))}
              </div>
            )}
            {posts.length > 0 && (
              <div className="pt-5">
                <div className="flex items-center gap-2 px-4 mb-3">
                  <FileText size={12} className="text-green-400" />
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                    Posts
                  </p>
                </div>
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <p className="text-white/40 text-[10px] mb-1 font-semibold">
                      @{post.author}
                    </p>
                    <p className="text-white/80 text-[13px] leading-snug line-clamp-2">
                      {post.content}
                    </p>
                    {post.media_url && (
                      <div className="mt-2 w-16 h-12 rounded-lg overflow-hidden bg-white/5">
                        <img
                          src={post.media_url}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          alt=""
                          decoding="async"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-1 mt-1.5">
                      <Heart size={10} className="text-red-400" />
                      <span className="text-white/30 text-[10px] font-semibold">
                        {post.likes_count || 0}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {!isSearching && (
          <>
            {sugPeople.length > 0 && (
              <div className="pt-5">
                <div className="flex items-center gap-2 px-4 mb-3">
                  <span className="text-[12px]">🔥</span>
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                    Suggested People
                  </p>
                </div>
                {sugPeople.map((person) => (
                  <div
                    key={person.id}
                    className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <div className="relative shrink-0">
                      <div className="w-11 h-11 rounded-full bg-blue-600 overflow-hidden border border-white/10">
                        {person.avatar_url ? (
                          <img
                            src={person.avatar_url}
                            className="w-full h-full object-cover"
                            alt=""
                            decoding="async"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white font-black text-sm">
                            {person.full_name?.[0]}
                          </div>
                        )}
                      </div>
                      {(() => {
                        const online =
                          person.last_seen &&
                          Date.now() - new Date(person.last_seen).getTime() <
                            5 * 60 * 1000;
                        return online ? (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-[#0f172a]" />
                        ) : null;
                      })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-[13px] truncate">
                        {person.full_name}
                      </p>
                      {(person.fame_points || 0) > 0 && (
                        <p className="text-yellow-400/60 text-[10px]">
                          ⭐ {person.fame_points} fame
                        </p>
                      )}
                    </div>
                    <AddBtn id={person.id} />
                  </div>
                ))}
              </div>
            )}
            {sugCircles.length > 0 && (
              <div className="pt-5">
                <div className="flex items-center gap-2 px-4 mb-3">
                  <span className="text-[12px]">👥</span>
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                    Popular Circles
                  </p>
                </div>
                {sugCircles.map((circle) => (
                  <div
                    key={circle.id}
                    className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <div
                      className="w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-white/10"
                      style={{ background: circleGrad(circle.id) }}
                    >
                      {circle.cover_url && (
                        <img
                          src={circle.cover_url}
                          className="w-full h-full object-cover"
                          alt=""
                          decoding="async"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-[13px] truncate">
                        {circle.name}
                      </p>
                      <p className="text-white/40 text-[10px]">
                        {circle.member_count ?? 0} members
                      </p>
                    </div>
                    <button className="px-3 py-1.5 bg-white/10 border border-white/15 rounded-xl text-[10px] font-black text-white/70 active:scale-95 transition-transform shrink-0">
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}
            {sugHooks.length > 0 && (
              <div className="pt-5">
                <div className="flex items-center gap-2 px-4 mb-3">
                  <span className="text-[12px]">🪝</span>
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                    Trending Hooks
                  </p>
                </div>
                {sugHooks.map((hook) => (
                  <div
                    key={hook.id}
                    className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <div
                      className="w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-white/10"
                      style={{
                        background: "linear-gradient(135deg,#f59e0b,#ef4444)",
                      }}
                    >
                      {hook.cover_url && (
                        <img
                          src={hook.cover_url}
                          className="w-full h-full object-cover"
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-[13px] truncate">
                        {hook.name}
                      </p>
                      <p className="text-white/40 text-[10px]">
                        {hook.hook_count ?? 0} hooks
                        {hook.category ? ` · ${hook.category}` : ""}
                      </p>
                    </div>
                    <span className="text-[10px] font-black text-amber-400/70 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg shrink-0">
                      Trending
                    </span>
                  </div>
                ))}
              </div>
            )}
            {sugPeople.length === 0 &&
              sugCircles.length === 0 &&
              sugHooks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 gap-3 text-white/20">
                  <Search size={40} strokeWidth={1.5} />
                  <p className="text-[11px] font-black uppercase tracking-widest">
                    Start typing to search
                  </p>
                </div>
              )}
          </>
        )}
      </div>

      {/* ── Inline Post Viewer ─────────────────────────────────────────── */}
      <AnimatePresence>
        {viewingPost && (
          <>
            <motion.div
              className="absolute inset-0 z-10 bg-black/70"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingPost(null)}
            />
            <motion.div
              className="absolute inset-x-4 top-1/2 z-20 rounded-3xl overflow-hidden shadow-2xl"
              style={{
                transform: "translateY(-50%)",
                background: "rgba(15,18,32,0.98)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
            >
              {/* header row */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-blue-600 border border-white/10 shrink-0">
                  {viewingPost.author_avatar ? (
                    <img
                      src={viewingPost.author_avatar}
                      className="w-full h-full object-cover"
                      alt=""
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white font-black text-sm">
                      {viewingPost.author_name?.[0]}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-black text-[13px] truncate">
                    {viewingPost.author_name}
                  </p>
                  <p className="text-white/30 text-[10px]">
                    {viewingPost.created_at
                      ? timeAgo(viewingPost.created_at)
                      : ""}
                  </p>
                </div>
                <button
                  onClick={() => setViewingPost(null)}
                  className="p-1.5 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all"
                >
                  <X size={16} />
                </button>
              </div>
              {/* media */}
              {viewingPost.media_url &&
                !/\.(mp4|webm|ogg|mov)/i.test(
                  viewingPost.media_url.split("?")[0],
                ) && (
                  <img
                    src={viewingPost.media_url}
                    className="w-full max-h-72 object-cover"
                    loading="lazy"
                    alt=""
                    decoding="async"
                  />
                )}
              {viewingPost.media_url &&
                /\.(mp4|webm|ogg|mov)/i.test(
                  viewingPost.media_url.split("?")[0],
                ) && (
                  <video
                    src={viewingPost.media_url}
                    className="w-full max-h-72 object-cover"
                    controls
                    playsInline
                    preload="none"
                  />
                )}
              {/* content */}
              {viewingPost.content && (
                <p className="text-white/80 text-[13px] leading-relaxed px-4 py-3">
                  {viewingPost.content}
                </p>
              )}
              {/* like row */}
              <div className="flex items-center gap-3 px-4 pb-4">
                <button
                  onClick={(e) => handleLikePost(e, viewingPost)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all active:scale-90"
                  style={{
                    background: likedPosts.has(viewingPost.id)
                      ? "rgba(239,68,68,0.15)"
                      : "rgba(255,255,255,0.06)",
                  }}
                >
                  <Heart
                    size={16}
                    fill={likedPosts.has(viewingPost.id) ? "#ef4444" : "none"}
                    className={
                      likedPosts.has(viewingPost.id)
                        ? "text-red-400"
                        : "text-white/40"
                    }
                  />
                  <span
                    className={`text-[12px] font-bold ${likedPosts.has(viewingPost.id) ? "text-red-400" : "text-white/40"}`}
                  >
                    {viewingPost.likes_count || 0} Likes
                  </span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ── Actor Avatar ────────────────────────────────────────────────────────────────
const ActorAvatar = ({
  name,
  avatarUrl,
  size = 36,
}: {
  name: string;
  avatarUrl?: string;
  size?: number;
}) => (
  <div
    className="rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-black shrink-0 border-2 border-white/10"
    style={{ width: size, height: size, fontSize: size * 0.38 }}
  >
    {avatarUrl ? (
      <img
        src={avatarUrl}
        className="w-full h-full object-cover"
        alt=""
        decoding="async"
      />
    ) : (
      (name?.[0] || "?").toUpperCase()
    )}
  </div>
);

// ── Stat Pill ───────────────────────────────────────────────────────────────────
type DashTab = "posts" | "hooks" | "circles" | "likes" | "friends" | "magnet";
const DASH_TABS: {
  key: DashTab;
  label: string;
  icon: React.ReactNode;
  color: string;
  glow: string;
}[] = [
  {
    key: "posts",
    label: "Posts",
    icon: <FileText size={15} />,
    color: "from-indigo-500 to-blue-600",
    glow: "rgba(99,102,241,0.5)",
  },
  {
    key: "hooks",
    label: "Hooks",
    icon: <Link2 size={15} />,
    color: "from-purple-500 to-fuchsia-600",
    glow: "rgba(168,85,247,0.5)",
  },
  {
    key: "circles",
    label: "Circles",
    icon: <Users size={14} />,
    color: "from-orange-500 to-amber-500",
    glow: "rgba(249,115,22,0.5)",
  },
  {
    key: "likes",
    label: "Likes",
    icon: <Heart size={15} />,
    color: "from-rose-500 to-pink-600",
    glow: "rgba(244,63,94,0.5)",
  },
  {
    key: "friends",
    label: "Friends",
    icon: <Users size={15} />,
    color: "from-emerald-500 to-teal-600",
    glow: "rgba(16,185,129,0.5)",
  },
  {
    key: "magnet",
    label: "Links",
    icon: <Zap size={15} />,
    color: "from-teal-500 to-cyan-600",
    glow: "rgba(20,184,166,0.5)",
  },
];

// ── Main Header ────────────────────────────────────────────────────────────────
const Header = ({
  onProfileClick,
  onHomeClick,
  onSettingsClick,
  onNavigateToFeature,
  onChatClick,
  chatBadge,
  userId,
}: {
  onProfileClick?: () => void;
  onHomeClick?: () => void;
  onSettingsClick?: () => void;
  onNavigateToFeature?: (feature: string) => void;
  onChatClick?: () => void;
  chatBadge?: number;
  userId?: string;
}) => {
  // ── Existing state ─────────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState<any[]>([]);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  // ── Real-time bell state ───────────────────────────────────────────────────
  const [hasNewNotif, setHasNewNotif] = useState(false);
  const [newNotifPreview, setNewNotifPreview] = useState<any | null>(null);
  const newNotifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [userData, setUserData] = useState({
    full_name: "...",
    avatar_url: "",
    id: userId || "",
    bio: "",
    school: "",
    mobile: "",
    location: "",
  });

  // ── Power Dashboard state ──────────────────────────────────────────────────
  const [showDash, setShowDash] = useState(false);
  const [dashTab, setDashTab] = useState<DashTab>("friends");
  const [dashStats, setDashStats] = useState({
    posts: 0,
    hooks: 0,
    circles: 0,
    likes: 0,
    friends: 0,
    magnet: 0,
  });
  const [dashMagnetSent, setDashMagnetSent] = useState(0);
  const [dashMagnetReceived, setDashMagnetReceived] = useState(0);
  const [dashMagnetFetched, setDashMagnetFetched] = useState(false);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashFriends, setDashFriends] = useState<FriendEntry[]>([]);
  const [dashFriendsLoading, setDashFriendsLoading] = useState(false);
  const [dashPosts, setDashPosts] = useState<any[]>([]);
  const [dashHooks, setDashHooks] = useState<any[]>([]);
  const [dashCircles, setDashCircles] = useState<any[]>([]);
  const [dashPostsFetched, setDashPostsFetched] = useState(false);
  const [dashHooksFetched, setDashHooksFetched] = useState(false);
  const [dashCirclesFetched, setDashCirclesFetched] = useState(false);

  // ── KICK state ─────────────────────────────────────────────────────────────
  const [kickTarget, setKickTarget] = useState<FriendEntry | null>(null);
  const [kickingId, setKickingId] = useState<string | null>(null);

  // ── Fetchers ──────────────────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, bio, school, mobile, location")
      .eq("id", userId)
      .single();
    if (data) setUserData((prev) => ({ ...prev, ...data }));
  }, [userId]);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("notifier_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (data && data.length > 0) {
      const actorIds = [
        ...new Set(data.filter((n) => n.actor_id).map((n) => n.actor_id)),
      ];
      let profileMap: Record<string, any> = {};
      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", actorIds);
        profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
      }
      setNotifications(
        data.map((n) => ({ ...n, actor: profileMap[n.actor_id] || null })),
      );
    } else {
      setNotifications([]);
    }
  }, [userId]);

  const fetchFriendRequests = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("friendships")
      .select("*")
      .eq("receiver_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (data && data.length > 0) {
      const senderIds = [...new Set(data.map((r) => r.sender_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", senderIds);
      const profileMap = Object.fromEntries(
        (profiles || []).map((p) => [p.id, p]),
      );
      setFriendRequests(
        data.map((r) => ({ ...r, sender: profileMap[r.sender_id] || null })),
      );
    } else {
      setFriendRequests([]);
    }
  }, [userId]);

  // ── Dashboard Fetchers ─────────────────────────────────────────────────────
  const fetchDashStats = useCallback(async () => {
    if (!userId) return;
    setDashLoading(true);
    const [postsRes, hooksRes, circlesRes, friendsRes, postsLikesRes, magnetSentRes] =
      await Promise.all([
        supabase
          .from("posts")
          .select("id", { count: "exact", head: true })
          .eq("author_id", userId),
        supabase
          .from("page_followers")
          .select("page_id", { count: "exact", head: true })
          .eq("user_id", userId),
        supabase
          .from("circle_members")
          .select("circle_id", { count: "exact", head: true })
          .eq("user_id", userId),
        supabase
          .from("friendships")
          .select("id", { count: "exact", head: true })
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
          .eq("status", "accepted"),
        supabase.from("posts").select("likes_count").eq("author_id", userId),
        supabase
          .from("magnet_chains")
          .select("id", { count: "exact", head: true })
          .eq("invited_by", userId),
      ]);
    const totalLikes = (postsLikesRes.data || []).reduce(
      (sum: number, p: any) => sum + (p.likes_count || 0),
      0,
    );
    setDashStats({
      posts: postsRes.count ?? 0,
      hooks: hooksRes.count ?? 0,
      circles: circlesRes.count ?? 0,
      likes: totalLikes,
      friends: friendsRes.count ?? 0,
      magnet: magnetSentRes.count ?? 0,
    });
    setDashLoading(false);
  }, [userId]);

  const fetchDashFriends = useCallback(async () => {
    if (!userId) return;
    setDashFriendsLoading(true);
    console.log("[PowerDash] fetchDashFriends — userId:", userId);

    // Step 1: get accepted friendship rows
    const { data: rows, error } = await supabase
      .from("friendships")
      .select("id, sender_id, receiver_id")
      .eq("status", "accepted")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .limit(50);

    console.log(
      "[PowerDash] friendships rows:",
      rows?.length ?? 0,
      "| error:",
      error ?? "none",
    );

    if (!rows || rows.length === 0) {
      setDashFriends([]);
      setDashFriendsLoading(false);
      return;
    }

    // Step 2: collect the friend's profile ids (the "other" person)
    const friendIds = rows.map((r: any) =>
      r.sender_id === userId ? r.receiver_id : r.sender_id,
    );
    console.log("[PowerDash] friendIds to fetch profiles for:", friendIds);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", friendIds);

    console.log("[PowerDash] profiles fetched:", profiles?.length ?? 0);

    const profileMap: Record<string, any> = Object.fromEntries(
      (profiles || []).map((p) => [p.id, p]),
    );

    const parsed: FriendEntry[] = rows
      .map((r: any) => {
        const friendId = r.sender_id === userId ? r.receiver_id : r.sender_id;
        const p = profileMap[friendId];
        return p
          ? {
              friendshipId: r.id,
              id: p.id,
              full_name: p.full_name,
              avatar_url: p.avatar_url,
            }
          : null;
      })
      .filter((f): f is FriendEntry => !!f && !!f.id);

    console.log("[PowerDash] parsed friends:", parsed.length);
    setDashFriends(parsed);
    setDashFriendsLoading(false);
  }, [userId]);

  const fetchDashPosts = useCallback(async () => {
    if (!userId || dashPostsFetched) return;
    const { data } = await supabase
      .from("posts")
      .select("id,content,media_url,likes_count,created_at")
      .eq("author_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    setDashPosts(data || []);
    setDashPostsFetched(true);
  }, [userId, dashPostsFetched]);

  const fetchDashHooks = useCallback(async () => {
    if (!userId || dashHooksFetched) return;
    const { data } = await supabase
      .from("page_followers")
      .select(
        "page_id, hook_pages(id,name,avatar_url,follower_count,followers_count)",
      )
      .eq("user_id", userId)
      .limit(20);
    setDashHooks(data || []);
    setDashHooksFetched(true);
  }, [userId, dashHooksFetched]);

  const fetchDashCircles = useCallback(async () => {
    if (!userId || dashCirclesFetched) return;
    const { data } = await supabase
      .from("circle_members")
      .select(
        "circle_id, circles(id, name, cover_url, description, member_count, privacy)",
      )
      .eq("user_id", userId)
      .limit(20);
    setDashCircles(data || []);
    setDashCirclesFetched(true);
  }, [userId, dashCirclesFetched]);

  const fetchDashMagnets = useCallback(async () => {
    if (!userId || dashMagnetFetched) return;
    const [sentRes, receivedRes] = await Promise.all([
      supabase
        .from("magnet_chains")
        .select("id", { count: "exact", head: true })
        .eq("invited_by", userId),
      supabase
        .from("magnet_chains")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("invited_by", "is", null),
    ]);
    setDashMagnetSent(sentRes.count ?? 0);
    setDashMagnetReceived(receivedRes.count ?? 0);
    setDashMagnetFetched(true);
  }, [userId, dashMagnetFetched]);

  // ── KICK Logic ─────────────────────────────────────────────────────────────
  const confirmKick = async () => {
    if (!kickTarget || kickingId) return;
    const target = kickTarget;
    setKickTarget(null);
    setKickingId(target.id);

    await supabase.from("friendships").delete().eq("id", target.friendshipId);

    setTimeout(() => {
      setDashFriends((prev) => prev.filter((f) => f.id !== target.id));
      setDashStats((prev) => ({
        ...prev,
        friends: Math.max(0, prev.friends - 1),
      }));
      setKickingId(null);
    }, 650);

    toast(
      <div className="flex items-center gap-2 font-bold text-sm">
        <span className="text-2xl">⚽</span>
        <span>Chal hat hawa aane de... Kicked out of the field!</span>
      </div>,
      {
        duration: 3500,
        style: {
          background: "#1a1a2e",
          color: "#fff",
          border: "1.5px solid #ef4444",
          borderRadius: "14px",
          fontFamily: "inherit",
        },
      },
    );
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const acceptRequest = async (reqId: string, senderId: string) => {
    setActionLoading(reqId);
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", reqId);
    if (error) {
      toast.error("Request accept nahi ho saki: " + error.message);
      setActionLoading(null);
      return;
    }
    await supabase
      .from("notifications")
      .insert({
        notifier_id: senderId,
        actor_id: userId,
        type: "friend_accepted",
        entity_id: reqId,
        content: "accepted your friend request",
        is_read: false,
      });
    toast.success("Friend request accept ho gayi!");
    setFriendRequests((prev) => prev.filter((r) => r.id !== reqId));
    setActionLoading(null);
  };

  const rejectRequest = async (reqId: string) => {
    setActionLoading(reqId + "_reject");
    await supabase
      .from("friendships")
      .update({ status: "rejected" })
      .eq("id", reqId);
    setFriendRequests((prev) => prev.filter((r) => r.id !== reqId));
    setActionLoading(null);
  };

  const markAllRead = async () => {
    if (!userId) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("notifier_id", userId)
      .eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const markOneRead = async (id: string) => {
    // Mark the leader
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
  };

  const markGroupRead = async (groupIds: string[]) => {
    if (groupIds.length === 0) return;
    await supabase.from("notifications").update({ is_read: true }).in("id", groupIds);
    setNotifications((prev) =>
      prev.map((n) => (groupIds.includes(n.id) ? { ...n, is_read: true } : n)),
    );
  };

  const playNotifSound = () => {
    try {
      const audio = new Audio("/notif.wav");
      audio.volume = 1.0;
      audio.play().catch(() => {});
    } catch {}
  };

  const handleNotifClick = (n: any) => {
    console.log("Notification Data:", n);

    // Mark as read (handle grouped notifications)
    if (n._group && Array.isArray(n._group)) {
      const unreadInGroup = n._group.filter((g: any) => !g.is_read);
      if (unreadInGroup.length > 0) {
        markGroupRead(unreadInGroup.map((g: any) => g.id));
      }
    } else if (!n.is_read) {
      markOneRead(n.id);
    }

    // Story notifications → open story viewer
    const storyTypes = ["story_like", "story_comment"];
    const storyId = n.entity_id;
    if (storyId && storyTypes.includes(n.type)) {
      setShowNotif(false);
      console.log("Navigating to story:", storyId);
      window.dispatchEvent(
        new CustomEvent("flicks:open-story", { detail: { storyId } }),
      );
      return;
    }

    const postTypes = [
      "like", "comment", "mention", "new_post",
      "magnet_link", "magnet_accepted", "magnet",
      "share", "circle_share", "hook_share",
      "reply", "post_mention", "post_pin",
    ];
    if (n.entity_id && postTypes.includes(n.type)) {
      setShowNotif(false);
      onHomeClick?.();
      setTimeout(() => {
        const el = document.getElementById(n.entity_id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.style.outline = "2px solid #3b82f6";
          el.style.borderRadius = "16px";
          setTimeout(() => {
            el.style.outline = "";
            el.style.borderRadius = "";
          }, 2200);
        }
      }, 420);
    }
  };

  // ── Real-time setup ────────────────────────────────────────────────────────
  const fetchNotifsRef = useRef(fetchNotifications);
  const fetchFriendReqsRef = useRef(fetchFriendRequests);
  useEffect(() => {
    fetchNotifsRef.current = fetchNotifications;
  }, [fetchNotifications]);
  useEffect(() => {
    fetchFriendReqsRef.current = fetchFriendRequests;
  }, [fetchFriendRequests]);

  useEffect(() => {
    if (!userId) return;
    fetchProfile();
    fetchNotifsRef.current();
    fetchFriendReqsRef.current();

    const notifCh = supabase
      .channel(`notif-live-v2-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        (payload) => {
          const row = (payload.new || payload.old) as any;
          if (row?.notifier_id !== userId) return;
          if (payload.eventType === "INSERT") {
            playNotifSound();
            setHasNewNotif(true);
            setNewNotifPreview(row);
            if (newNotifTimerRef.current) clearTimeout(newNotifTimerRef.current);
            newNotifTimerRef.current = setTimeout(() => {
              setNewNotifPreview(null);
            }, 4500);
          }
          fetchNotifsRef.current();
        },
      )
      .subscribe();

    const friendCh = supabase
      .channel(`friend-live-v2-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        (payload) => {
          const row = (payload.new || payload.old) as any;
          if (row?.receiver_id !== userId) return;
          fetchFriendReqsRef.current();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifCh);
      supabase.removeChannel(friendCh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── Fetch dashboard stats when it opens ────────────────────────────────────
  useEffect(() => {
    if (showDash) {
      fetchDashStats();
      fetchDashFriends();
    }
  }, [showDash, fetchDashStats, fetchDashFriends]);


  // ── Live DP update from Settings > Personal Info ───────────────────────────
  useEffect(() => {
    const avatarHandler = (e: Event) => {
      const url = (e as CustomEvent<{ url: string }>).detail?.url;
      if (url) setUserData((prev) => ({ ...prev, avatar_url: url }));
    };
    const profileHandler = () => {
      fetchProfile();
    };
    window.addEventListener("flicks-avatar-updated", avatarHandler);
    window.addEventListener("flicks-profile-updated", profileHandler);
    return () => {
      window.removeEventListener("flicks-avatar-updated", avatarHandler);
      window.removeEventListener("flicks-profile-updated", profileHandler);
    };
  }, [fetchProfile]);

  // ── Fetch tab-specific data on tab change ──────────────────────────────────
  useEffect(() => {
    if (!showDash) return;
    if (dashTab === "friends") fetchDashFriends();
    if (dashTab === "posts") fetchDashPosts();
    if (dashTab === "hooks") fetchDashHooks();
    if (dashTab === "circles") fetchDashCircles();
    if (dashTab === "magnet") fetchDashMagnets();
  }, [
    dashTab,
    showDash,
    fetchDashFriends,
    fetchDashPosts,
    fetchDashHooks,
    fetchDashCircles,
    fetchDashMagnets,
  ]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const totalBadge = unreadCount + friendRequests.length;
  const hasAnything = notifications.length > 0 || friendRequests.length > 0;

  return (
    <>
      {/* ── GLASS HEADER ─────────────────────────────────────────────────── */}
      <header
        className="w-full h-14 backdrop-blur-2xl border-b border-white/10 sticky top-0 z-[100] px-3 sm:px-5 flex items-center gap-3 transition-all relative overflow-hidden"
        style={{ background: "rgba(10,10,20,0.95)" }}
      >
        <div className="flex items-center gap-2 flex-shrink-0">
          <motion.div
            animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
            transition={{
              duration: 3.5,
              repeat: Infinity,
              repeatDelay: 4,
              ease: "easeInOut",
            }}
            className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0"
          >
            <span className="text-white font-black text-[12px] italic">F</span>
          </motion.div>
          <FlicksLogo />
          <TirangaFlag />
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 flex-shrink-0">
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={onHomeClick}
            className="p-2 rounded-xl transition-all active:scale-90 flex-shrink-0 border border-lime-400/25 hover:bg-lime-400/10"
            style={{ background: "rgba(163,230,53,0.08)" }}
          >
            <Home size={17} className="text-lime-400" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => setShowSearch(true)}
            className="p-2 rounded-xl transition-all active:scale-90 flex-shrink-0 border border-lime-400/25 hover:bg-lime-400/15"
            style={{ background: "rgba(163,230,53,0.08)" }}
          >
            <Search size={17} className="text-lime-400" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              setShowNotif((v) => !v);
              if (!showNotif) {
                fetchFriendRequests();
                setHasNewNotif(false);
                setNewNotifPreview(null);
                if (newNotifTimerRef.current) clearTimeout(newNotifTimerRef.current);
              }
            }}
            className="p-2.5 rounded-2xl relative transition-all flex-shrink-0 border hover:bg-lime-400/15"
            style={{
              background: hasNewNotif ? "rgba(239,68,68,0.12)" : "rgba(163,230,53,0.08)",
              borderColor: hasNewNotif ? "rgba(239,68,68,0.5)" : "rgba(163,230,53,0.25)",
            }}
          >
            {/* Pulse glow ring — only when new notification */}
            <AnimatePresence>
              {hasNewNotif && (
                <motion.span
                  key="notif-pulse"
                  initial={{ scale: 1, opacity: 0.7 }}
                  animate={{ scale: 1.9, opacity: 0 }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: "easeOut" }}
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{ background: "rgba(239,68,68,0.35)", border: "1.5px solid rgba(239,68,68,0.55)" }}
                />
              )}
            </AnimatePresence>
            {/* Bell icon — rings on new notif */}
            <motion.div
              animate={hasNewNotif
                ? { rotate: [0, -18, 18, -13, 13, -8, 8, -4, 4, 0] }
                : { rotate: 0 }
              }
              transition={hasNewNotif
                ? { duration: 0.75, repeat: Infinity, repeatDelay: 2.5, ease: "easeInOut" }
                : {}
              }
            >
              <Bell
                size={18}
                className={hasNewNotif ? "text-red-400 drop-shadow-md" : "text-lime-400 drop-shadow-md"}
              />
            </motion.div>
            {totalBadge > 0 && (
              <motion.span
                key={totalBadge}
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-[#0a0a14] px-0.5"
              >
                {totalBadge > 99 ? "99+" : totalBadge}
              </motion.span>
            )}
          </motion.button>
          {/* Chat — opens full-screen messenger */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={onChatClick}
            className="p-2 rounded-xl transition-all active:scale-90 flex-shrink-0 border border-lime-400/25 hover:bg-lime-400/10 relative"
            style={{ background: "rgba(163,230,53,0.08)" }}
          >
            <MessageCircle size={17} className="text-lime-400" />
            {chatBadge && chatBadge > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border border-[#0a0a14] px-0.5">
                {chatBadge > 99 ? "99+" : chatBadge}
              </span>
            )}
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={onSettingsClick}
            className="p-2 rounded-xl transition-all active:scale-90 flex-shrink-0 border border-lime-400/25 hover:bg-lime-400/10"
            style={{ background: "rgba(163,230,53,0.08)" }}
          >
            <Settings size={17} className="text-lime-400" />
          </motion.button>

          {/* Avatar → opens Power Dashboard */}
          <motion.div
            whileTap={{ scale: 0.88 }}
            onClick={() => {
              setShowDash(true);
              setDashFriends([]);
            }}
            className="w-9 h-9 rounded-xl overflow-hidden border-2 border-yellow-400/60 shadow-lg cursor-pointer flex-shrink-0 relative"
            style={{ boxShadow: "0 0 12px rgba(250,204,21,0.35)" }}
          >
            {userData.avatar_url ? (
              <img
                src={userData.avatar_url}
                loading="lazy"
                className="w-full h-full object-cover"
                alt="Profile"
                decoding="async"
              />
            ) : (
              <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white font-black text-xs">
                {userData?.full_name?.[0]?.toUpperCase() || "U"}
              </div>
            )}
          </motion.div>
        </div>
      </header>

      {/* ── REAL-TIME NOTIFICATION PREVIEW TOAST ─────────────────────────── */}
      <AnimatePresence>
        {newNotifPreview && !showNotif && (
          <motion.div
            key="notif-preview-toast"
            initial={{ opacity: 0, y: -12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: "spring", damping: 22, stiffness: 260 }}
            className="fixed top-16 right-3 z-[120] w-[calc(100vw-24px)] max-w-[340px] rounded-2xl overflow-hidden shadow-2xl cursor-pointer"
            style={{ background: "rgba(12,12,24,0.97)", border: "1px solid rgba(239,68,68,0.4)", backdropFilter: "blur(20px)" }}
            onClick={() => {
              setShowNotif(true);
              setHasNewNotif(false);
              setNewNotifPreview(null);
              if (newNotifTimerRef.current) clearTimeout(newNotifTimerRef.current);
              fetchFriendRequests();
            }}
          >
            {/* Red accent bar at top */}
            <div className="h-0.5 w-full" style={{ background: "linear-gradient(90deg, #ef4444, #f97316, #ef4444)" }} />
            <div className="flex items-center gap-3 px-4 py-3">
              {/* Notification icon chip */}
              <div className="shrink-0 w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                {(() => {
                  const meta = NOTIF_META[newNotifPreview.type];
                  return meta
                    ? <span className={`text-base ${meta.color.split(" ")[1]}`}>{meta.icon}</span>
                    : <Bell size={16} className="text-red-400" />;
                })()}
              </div>
              {/* Text content */}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black text-red-400 uppercase tracking-widest mb-0.5">
                  New notification
                </p>
                <p className="text-white text-[13px] font-semibold leading-snug line-clamp-2">
                  {newNotifPreview.content
                    ? (newNotifPreview.content.startsWith("{")
                      ? (() => { try { return JSON.parse(newNotifPreview.content)?.text || "New activity"; } catch { return "New activity"; } })()
                      : newNotifPreview.content)
                    : (NOTIF_META[newNotifPreview.type]?.label || "New activity")}
                </p>
              </div>
              {/* Dismiss */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setNewNotifPreview(null);
                  if (newNotifTimerRef.current) clearTimeout(newNotifTimerRef.current);
                }}
                className="shrink-0 p-1.5 rounded-full text-white/30 hover:text-white/70 hover:bg-white/10 transition-all"
              >
                <X size={14} />
              </button>
            </div>
            {/* Progress bar — empties over 4.5s to signal auto-dismiss */}
            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 4.5, ease: "linear" }}
              className="h-0.5 origin-left"
              style={{ background: "linear-gradient(90deg, #ef4444, #f97316)" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SEARCH MODAL ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSearch && (
          <SearchModal onClose={() => setShowSearch(false)} userId={userId} />
        )}
      </AnimatePresence>

      {/* ── NOTIFICATIONS DRAWER ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showNotif && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNotif(false)}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[105]"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="fixed top-0 right-0 h-full w-full max-w-sm bg-slate-900/90 backdrop-blur-3xl shadow-2xl z-[110] border-l border-white/10 flex flex-col overflow-hidden"
            >
              {/* Header Section */}
              <div className="px-5 py-4 flex items-center justify-between border-b border-white/10 bg-white/5 shrink-0">
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-white/70" />
                  <h2 className="font-black text-white tracking-wide text-[13px]">
                    Notifications
                  </h2>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-500/80 rounded-full text-[9px] font-black text-white">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowNotif(false)}
                  className="p-1.5 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content Section */}
              <div className="flex-1 overflow-y-auto">
                {!hasAnything ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-white/20 py-16">
                    <Bell size={44} strokeWidth={1} />
                    <p className="text-[11px] font-black uppercase tracking-widest">
                      No notifications yet
                    </p>
                  </div>
                ) : (
                  <div className="pb-3">
                    {/* ── Friend Request Cards (large, prominent) ── */}
                    {friendRequests.length > 0 && (
                      <div className="px-3 pt-3 space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40 px-1">
                          Friend Requests ({friendRequests.length})
                        </p>
                        {friendRequests.map((req: any) => (
                          <motion.div
                            key={req.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-2xl p-4 border border-blue-500/25"
                            style={{ background: "linear-gradient(135deg,rgba(37,99,235,0.18),rgba(124,58,237,0.12))" }}
                          >
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-blue-400/40 shrink-0">
                                {req.sender?.avatar_url ? (
                                  <img src={req.sender.avatar_url} className="w-full h-full object-cover" decoding="async" alt="" />
                                ) : (
                                  <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white font-black text-xl">
                                    {req.sender?.full_name?.[0]?.toUpperCase() || "?"}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-black text-white text-[15px] truncate">{req.sender?.full_name || "Unknown"}</p>
                                <p className="text-blue-300/70 text-[12px] mt-0.5">wants to be your friend</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => acceptRequest(req.id, req.sender_id)}
                                disabled={actionLoading === req.id + "_accept"}
                                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-[13px] active:scale-95 transition-all disabled:opacity-60"
                              >
                                {actionLoading === req.id + "_accept" ? "..." : "✓ Accept"}
                              </button>
                              <button
                                onClick={() => rejectRequest(req.id)}
                                disabled={actionLoading === req.id + "_reject"}
                                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-black text-[13px] active:scale-95 transition-all disabled:opacity-60"
                              >
                                {actionLoading === req.id + "_reject" ? "..." : "✕ Decline"}
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {/* ── Notifications List ── */}
                    {notifications.length > 0 && (
                      <div className="p-3 space-y-2">
                        {groupNotifications(notifications).map((n: any) => {
                          const meta = NOTIF_META[n.type] || NOTIF_META["new_post"];
                          const action = formatNotifAction(n.type, n.content);
                          const richShare = ["share", "circle_share", "hook_share"].includes(n.type)
                            ? parseRichShare(n.content) : null;
                          const isUnread = !n.is_read || (n._group && n._group.some((g: any) => !g.is_read));
                          const actorName = n._group
                            ? (n._group[0]?.actor?.full_name || "Someone")
                            : (n.actor?.full_name || "Someone");
                          const actorAvatar = n._group ? n._group[0]?.actor?.avatar_url : n.actor?.avatar_url;
                          const groupExtra = n._group && n._group.length > 1 ? n._group.length - 1 : 0;

                          return (
                            <motion.div
                              key={n.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              onClick={() => handleNotifClick(n)}
                              className={`flex items-start gap-3 p-3.5 rounded-2xl cursor-pointer active:scale-[0.98] transition-transform ${isUnread ? "bg-blue-600/10 border border-blue-500/20" : "bg-white/[0.04] border border-white/5"}`}
                            >
                              {/* Actor avatar / icon */}
                              <div
                                className={`w-10 h-10 rounded-full shrink-0 overflow-hidden flex items-center justify-center border border-white/10 ${actorAvatar ? "" : meta.color}`}
                                style={{ background: actorAvatar ? undefined : undefined }}
                              >
                                {actorAvatar ? (
                                  <img src={actorAvatar} className="w-full h-full object-cover" decoding="async" alt="" />
                                ) : (
                                  <div className={`w-full h-full flex items-center justify-center rounded-full ${meta.color}`}>
                                    {meta.icon}
                                  </div>
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                {/* Actor name + action */}
                                <p className="text-[13px] leading-snug text-white/90">
                                  <span className="font-black">{actorName}</span>
                                  {groupExtra > 0 && (
                                    <span className="text-white/50"> and {groupExtra} other{groupExtra > 1 ? "s" : ""}</span>
                                  )}
                                  {" "}<span className="text-white/70">{action.text}</span>
                                </p>
                                {/* Comment quote */}
                                {action.quote && (
                                  <p className="text-[11px] text-white/45 mt-0.5 italic truncate">"{action.quote}"</p>
                                )}
                                {/* Rich share preview */}
                                {richShare && (
                                  <div className="mt-2 flex gap-2.5 bg-white/[0.06] border border-white/10 rounded-xl p-2 overflow-hidden">
                                    {richShare.thumbnail_url && (
                                      <img
                                        src={richShare.thumbnail_url}
                                        alt=""
                                        className="w-12 h-12 object-cover shrink-0 rounded-lg"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                        decoding="async"
                                      />
                                    )}
                                    <div className="flex-1 min-w-0 py-0.5">
                                      <p className="text-[11px] font-bold text-white/90 truncate">{richShare.share_title}</p>
                                      <p className="text-[10px] text-white/50 line-clamp-2">{richShare.share_description}</p>
                                    </div>
                                  </div>
                                )}
                                {/* Timestamp */}
                                <p className="text-[10px] text-white/30 mt-1">{timeAgo(n.created_at)}</p>
                              </div>

                              {isUnread && (
                                <div className="shrink-0 mt-1.5">
                                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* ── POWER DASHBOARD DRAWER ────────────────────────────────────────── */}
      <AnimatePresence>
        {showDash && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowDash(false);
                setKickTarget(null);
                setDashFriends([]);
              }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[115]"
            />

            {/* Sidebar */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 210 }}
              className="fixed top-0 right-0 h-full w-full max-w-sm z-[120] flex flex-col overflow-hidden"
              style={{
                background:
                  "linear-gradient(160deg, #0f0c29 0%, #141428 50%, #0a0a1a 100%)",
                borderLeft: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {/* ── Dashboard Header ─────────────────────────────────────── */}
              <div
                className="relative px-5 pt-5 pb-4 shrink-0"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(37,99,235,0.25) 0%, rgba(79,70,229,0.15) 100%)",
                  borderBottom: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                {/* Close */}
                <button
                  onClick={() => {
                    setShowDash(false);
                    setKickTarget(null);
                    setDashFriends([]);
                  }}
                  className="absolute top-4 right-4 p-1.5 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-all"
                >
                  <X size={18} />
                </button>

                {/* Profile card */}
                <div className="flex gap-3 mb-4">
                  {/* Avatar */}
                  <div
                    className="w-16 h-16 rounded-2xl overflow-hidden border-2 shrink-0 self-start"
                    style={{
                      borderColor: "rgba(250,204,21,0.5)",
                      boxShadow: "0 0 18px rgba(250,204,21,0.3)",
                    }}
                  >
                    {userData.avatar_url ? (
                      <img
                        src={userData.avatar_url}
                        className="w-full h-full object-cover"
                        alt=""
                        decoding="async"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl">
                        {userData?.full_name?.[0]?.toUpperCase() || "U"}
                      </div>
                    )}
                  </div>

                  {/* Name + bio + meta */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-white font-black text-[16px] truncate leading-tight">
                      {userData.full_name}
                    </p>

                    <div className="flex items-center gap-1.5">
                      <Zap size={10} className="text-yellow-400" />
                      <span
                        className="text-[10px] font-black tracking-widest uppercase"
                        style={{
                          color: "#facc15",
                          textShadow: "0 0 8px rgba(250,204,21,0.6)",
                        }}
                      >
                        Power Dashboard
                      </span>
                    </div>

                    {/* Bio */}
                    {userData.bio ? (
                      <p className="text-[11px] text-white/55 leading-snug italic line-clamp-2 pt-0.5">
                        "{userData.bio}"
                      </p>
                    ) : null}

                    {/* School / Location / Mobile pills */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {userData.school ? (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-white/50 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">
                          <BookOpen size={9} className="text-blue-400" />
                          <span className="truncate max-w-[100px]">
                            {userData.school}
                          </span>
                        </span>
                      ) : null}
                      {userData.location ? (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-white/50 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">
                          <MapPin size={9} className="text-rose-400" />
                          <span className="truncate max-w-[90px]">
                            {userData.location}
                          </span>
                        </span>
                      ) : null}
                      {userData.mobile ? (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-white/50 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">
                          <Phone size={9} className="text-green-400" />
                          <span className="truncate max-w-[90px]">
                            {userData.mobile}
                          </span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* ── 5 Stat Pills ─────────────────────────────────────── */}
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                  {DASH_TABS.map((tab) => (
                    <motion.button
                      key={tab.key}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => setDashTab(tab.key)}
                      className={`flex flex-col items-center gap-1 py-2 px-0.5 rounded-2xl border transition-all ${dashTab === tab.key ? "border-white/20" : "border-white/8 hover:border-white/15"}`}
                      style={
                        dashTab === tab.key
                          ? {
                              background: `linear-gradient(135deg, ${tab.color.includes("indigo") ? "rgba(99,102,241,0.35)" : tab.color.includes("purple") ? "rgba(168,85,247,0.35)" : tab.color.includes("orange") ? "rgba(249,115,22,0.35)" : tab.color.includes("rose") ? "rgba(244,63,94,0.35)" : "rgba(16,185,129,0.35)"})`,
                              boxShadow: `0 4px 16px ${tab.glow}`,
                            }
                          : { background: "rgba(255,255,255,0.05)" }
                      }
                    >
                      <div
                        className={`text-white/60 ${dashTab === tab.key ? "text-white" : ""}`}
                      >
                        {tab.icon}
                      </div>
                      {dashLoading ? (
                        <div className="w-3 h-3 border border-white/30 border-t-white/80 rounded-full animate-spin" />
                      ) : (
                        <span className="text-white font-black text-[13px] leading-none">
                          {dashStats[tab.key] > 999
                            ? `${(dashStats[tab.key] / 1000).toFixed(1)}k`
                            : dashStats[tab.key]}
                        </span>
                      )}
                      <span
                        className={`text-[9px] font-black uppercase tracking-wide ${dashTab === tab.key ? "text-white/80" : "text-white/35"}`}
                      >
                        {tab.label}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* ── Tab Content ──────────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto relative">
                {/* ── KICK CONFIRMATION POPUP ─────────────────────────── */}
                <AnimatePresence>
                  {kickTarget && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-10 flex items-center justify-center px-5"
                      style={{
                        background: "rgba(10,10,26,0.88)",
                        backdropFilter: "blur(12px)",
                      }}
                    >
                      <motion.div
                        initial={{ scale: 0.85, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.85, y: 20 }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 22,
                        }}
                        className="w-full rounded-3xl p-6 text-center"
                        style={{
                          background:
                            "linear-gradient(145deg, #1a1a35, #12122a)",
                          border: "1.5px solid rgba(239,68,68,0.4)",
                          boxShadow: "0 20px 60px rgba(239,68,68,0.25)",
                        }}
                      >
                        <div className="text-5xl mb-3">⚽🥊</div>
                        <p className="text-white font-black text-[15px] leading-snug mb-1">
                          Bhai, kya aap sach mein
                        </p>
                        <p className="text-white font-black text-[15px] leading-snug mb-1">
                          <span className="text-yellow-400">
                            {kickTarget.full_name}
                          </span>{" "}
                          ko
                        </p>
                        <p className="text-white font-black text-[15px] leading-snug mb-5">
                          bahar ka rasta dikha rahe hain?
                        </p>

                        <div className="flex gap-3">
                          <motion.button
                            whileTap={{ scale: 0.94 }}
                            onClick={confirmKick}
                            className="flex-1 py-3 rounded-2xl font-black text-[13px] text-white transition-all"
                            style={{
                              background:
                                "linear-gradient(135deg, #dc2626, #b91c1c)",
                              boxShadow: "0 6px 20px rgba(220,38,38,0.45)",
                            }}
                          >
                            💨 Ha, Chal hat hawa aane de!
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.94 }}
                            onClick={() => setKickTarget(null)}
                            className="flex-1 py-3 rounded-2xl font-black text-[13px] text-white/70 border border-white/15 hover:bg-white/10 transition-all"
                          >
                            Nhi, Rehne do
                          </motion.button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── FRIENDS TAB ──────────────────────────────────────── */}
                {dashTab === "friends" && (
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Users size={13} className="text-emerald-400" />
                      <p className="text-[11px] font-black text-white/50 uppercase tracking-widest">
                        Friends · {dashStats.friends}
                      </p>
                      <span className="ml-auto text-[9px] text-red-400 font-black bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                        ⚽ Kick Mode ON
                      </span>
                    </div>

                    {/* ── Skeleton loader ── */}
                    {dashFriendsLoading && (
                      <div className="flex flex-col gap-2">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 rounded-2xl px-3 py-3 animate-pulse"
                            style={{
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.06)",
                            }}
                          >
                            <div className="w-11 h-11 rounded-xl bg-white/10 shrink-0" />
                            <div className="flex-1 space-y-2">
                              <div className="h-3 bg-white/10 rounded-full w-3/4" />
                              <div className="h-2 bg-white/6 rounded-full w-1/2" />
                            </div>
                            <div className="w-20 h-9 rounded-xl bg-red-500/10 shrink-0" />
                          </div>
                        ))}
                        <p className="text-center text-white/30 text-[11px] font-bold mt-2">
                          Loading friends...
                        </p>
                      </div>
                    )}

                    {/* ── Empty state ── */}
                    {!dashFriendsLoading && dashFriends.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/20">
                        <Users size={36} strokeWidth={1} />
                        <p className="text-[11px] font-black uppercase tracking-widest">
                          Koi dost nahi abhi
                        </p>
                      </div>
                    )}

                    {/* ── Friends list ── */}
                    {!dashFriendsLoading && dashFriends.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <AnimatePresence>
                          {dashFriends.map((f) => (
                            <motion.div
                              key={f.id}
                              layout
                              initial={{ opacity: 1, x: 0, rotate: 0 }}
                              animate={
                                kickingId === f.id
                                  ? {
                                      x: 420,
                                      rotate: 18,
                                      opacity: 0,
                                      scale: 0.8,
                                    }
                                  : { opacity: 1, x: 0, rotate: 0, scale: 1 }
                              }
                              exit={{
                                x: 420,
                                rotate: 18,
                                opacity: 0,
                                scale: 0.8,
                              }}
                              transition={
                                kickingId === f.id
                                  ? {
                                      type: "spring",
                                      stiffness: 280,
                                      damping: 18,
                                    }
                                  : { duration: 0.2 }
                              }
                              className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
                              style={{
                                background: "rgba(255,255,255,0.04)",
                                border: "1px solid rgba(255,255,255,0.07)",
                              }}
                            >
                              {/* Avatar */}
                              <div
                                className="w-11 h-11 rounded-xl overflow-hidden shrink-0"
                                style={{
                                  background:
                                    "linear-gradient(135deg, #1d4ed8, #4f46e5)",
                                }}
                              >
                                {f.avatar_url ? (
                                  <img
                                    src={f.avatar_url}
                                    className="w-full h-full object-cover"
                                    alt={f.full_name}
                                    decoding="async"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-white font-black text-base">
                                    {(f.full_name || "?")[0].toUpperCase()}
                                  </div>
                                )}
                              </div>

                              {/* Name */}
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-bold text-[14px] truncate">
                                  {f.full_name}
                                </p>
                                <p className="text-emerald-400/60 text-[10px] font-semibold">
                                  ✓ Friend
                                </p>
                              </div>

                              {/* ── BIG BOLD KICK BUTTON ── */}
                              <motion.button
                                whileTap={{ scale: 0.82 }}
                                whileHover={{
                                  scale: 1.08,
                                  boxShadow: "0 6px 24px rgba(239,68,68,0.55)",
                                }}
                                onClick={() => setKickTarget(f)}
                                disabled={!!kickingId}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-[13px] tracking-widest uppercase transition-all disabled:opacity-40 shrink-0"
                                style={{
                                  border: "2px solid rgba(239,68,68,0.8)",
                                  color: "#fff",
                                  background:
                                    "linear-gradient(135deg, rgba(220,38,38,0.7), rgba(239,68,68,0.5))",
                                  boxShadow: "0 4px 16px rgba(239,68,68,0.35)",
                                  letterSpacing: "0.08em",
                                }}
                              >
                                <span className="text-[17px] leading-none">
                                  ⚽
                                </span>
                                <span>KICK</span>
                              </motion.button>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                )}

                {/* ── POSTS TAB ────────────────────────────────────────── */}
                {dashTab === "posts" && (
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText size={13} className="text-indigo-400" />
                      <p className="text-[11px] font-black text-white/50 uppercase tracking-widest">
                        Your Posts · {dashStats.posts}
                      </p>
                    </div>
                    {dashPosts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/20">
                        <FileText size={36} strokeWidth={1} />
                        <p className="text-[11px] font-black uppercase tracking-widest">
                          Koi post nahi abhi
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {dashPosts.map((post) => (
                          <div
                            key={post.id}
                            className="rounded-2xl p-3"
                            style={{
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.07)",
                            }}
                          >
                            {post.media_url && (
                              <div className="w-full h-24 rounded-xl overflow-hidden mb-2 bg-white/5">
                                <img
                                  src={post.media_url}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  alt=""
                                  decoding="async"
                                />
                              </div>
                            )}
                            {post.content && (
                              <p className="text-white/80 text-[13px] leading-snug line-clamp-3 mb-2">
                                {post.content}
                              </p>
                            )}
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1">
                                <Heart size={11} className="text-red-400" />
                                <span className="text-white/40 text-[10px] font-bold">
                                  {post.likes_count || 0}
                                </span>
                              </div>
                              <span className="text-white/25 text-[10px]">
                                {post.created_at
                                  ? timeAgo(post.created_at)
                                  : ""}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── HOOKS TAB ────────────────────────────────────────── */}
                {dashTab === "hooks" && (
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Link2 size={13} className="text-purple-400" />
                      <p className="text-[11px] font-black text-white/50 uppercase tracking-widest">
                        Pages You Follow · {dashStats.hooks}
                      </p>
                    </div>
                    {dashHooks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/20">
                        <Link2 size={36} strokeWidth={1} />
                        <p className="text-[11px] font-black uppercase tracking-widest">
                          Koi page follow nahi kiya
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {dashHooks.map((item: any, i: number) => {
                          const page = item.hook_pages || {};
                          return (
                            <motion.div
                              key={item.page_id || i}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => {
                                if (onNavigateToFeature) {
                                  setShowDash(false);
                                  onNavigateToFeature("Hooks");
                                }
                              }}
                              className="flex items-center gap-3 rounded-2xl px-3 py-2.5 cursor-pointer active:opacity-80"
                              style={{
                                background: "rgba(255,255,255,0.04)",
                                border: "1px solid rgba(255,255,255,0.07)",
                              }}
                            >
                              <div
                                className="w-10 h-10 rounded-xl overflow-hidden shrink-0"
                                style={{
                                  background:
                                    "linear-gradient(135deg, #7c3aed, #a855f7)",
                                }}
                              >
                                {page.avatar_url ? (
                                  <img
                                    src={page.avatar_url}
                                    className="w-full h-full object-cover"
                                    alt=""
                                    decoding="async"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-white font-black text-sm">
                                    {(page.name || "P")[0]}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-bold text-[13px] truncate">
                                  {page.name || "Hook Page"}
                                </p>
                                <p className="text-white/30 text-[10px]">
                                  {page.followers_count ||
                                    page.follower_count ||
                                    0}{" "}
                                  followers
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Link2
                                  size={12}
                                  className="text-purple-400/50"
                                />
                                <span className="text-[9px] text-purple-400/60 font-black uppercase">
                                  Open
                                </span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── CIRCLES TAB ──────────────────────────────────────── */}
                {dashTab === "circles" && (
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Users size={13} className="text-orange-400" />
                      <p className="text-[11px] font-black text-white/50 uppercase tracking-widest">
                        Circles You've Joined · {dashStats.circles}
                      </p>
                    </div>
                    {dashCircles.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/20">
                        <Users size={36} strokeWidth={1} />
                        <p className="text-[11px] font-black uppercase tracking-widest">
                          Koi circle join nahi kiya
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {dashCircles.map((item: any, i: number) => {
                          const circle = item.circles || {};
                          return (
                            <motion.div
                              key={item.circle_id || i}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => {
                                if (onNavigateToFeature) {
                                  setShowDash(false);
                                  onNavigateToFeature("Circle");
                                }
                              }}
                              className="flex items-center gap-3 rounded-2xl px-3 py-2.5 cursor-pointer active:opacity-80"
                              style={{
                                background: "rgba(255,255,255,0.04)",
                                border: "1px solid rgba(249,115,22,0.18)",
                              }}
                            >
                              <div
                                className="w-10 h-10 rounded-xl overflow-hidden shrink-0"
                                style={{
                                  background:
                                    "linear-gradient(135deg, #f97316, #ea580c)",
                                }}
                              >
                                {circle.cover_url ? (
                                  <img
                                    src={circle.cover_url}
                                    className="w-full h-full object-cover"
                                    alt=""
                                    decoding="async"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-white font-black text-sm">
                                    {(circle.name || "C")[0]}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-bold text-[13px] truncate">
                                  {circle.name || "Circle"}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <p className="text-white/30 text-[10px]">
                                    {circle.member_count || 0} members
                                  </p>
                                  {circle.privacy && (
                                    <span className="text-[9px] text-orange-400/60 bg-orange-400/10 px-1.5 py-0.5 rounded-full font-bold uppercase">
                                      {circle.privacy}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Users
                                  size={12}
                                  className="text-orange-400/50"
                                />
                                <span className="text-[9px] text-orange-400/60 font-black uppercase">
                                  Open
                                </span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── LIKES TAB ────────────────────────────────────────── */}
                {dashTab === "likes" && (
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Heart size={13} className="text-rose-400" />
                      <p className="text-[11px] font-black text-white/50 uppercase tracking-widest">
                        Total Likes Received
                      </p>
                    </div>
                    <div className="flex flex-col items-center justify-center py-8 mb-4">
                      <motion.div
                        animate={{ scale: [1, 1.08, 1] }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                        className="text-6xl mb-3"
                      >
                        ❤️
                      </motion.div>
                      <p
                        className="text-white font-black text-[48px] leading-none"
                        style={{ textShadow: "0 0 30px rgba(244,63,94,0.6)" }}
                      >
                        {dashStats.likes}
                      </p>
                      <p className="text-white/40 text-[12px] font-bold mt-2">
                        total likes on your posts
                      </p>
                    </div>
                    {dashPosts.length === 0 && (
                      <div className="text-center text-white/20 text-[11px] font-black uppercase tracking-widest py-4">
                        Koi post nahi abhi
                      </div>
                    )}
                    {dashPosts.length > 0 && (
                      <>
                        <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2">
                          Top Liked Posts
                        </p>
                        <div className="flex flex-col gap-2">
                          {[...dashPosts]
                            .sort(
                              (a, b) =>
                                (b.likes_count || 0) - (a.likes_count || 0),
                            )
                            .slice(0, 5)
                            .map((post) => (
                              <div
                                key={post.id}
                                className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
                                style={{
                                  background: "rgba(255,255,255,0.04)",
                                  border: "1px solid rgba(255,255,255,0.07)",
                                }}
                              >
                                <div className="flex items-center gap-1 shrink-0">
                                  <Heart
                                    size={12}
                                    className="text-rose-400"
                                    fill="currentColor"
                                  />
                                  <span className="text-rose-300 font-black text-[13px]">
                                    {post.likes_count || 0}
                                  </span>
                                </div>
                                <p className="text-white/70 text-[12px] line-clamp-1 flex-1 min-w-0">
                                  {post.content || "(image post)"}
                                </p>
                              </div>
                            ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ── MAGNET / LINKS TAB ────────────────────────────────── */}
                {dashTab === "magnet" && (
                  <div className="p-4 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap size={13} className="text-teal-400" />
                      <p className="text-[11px] font-black text-white/50 uppercase tracking-widest">
                        Viral Link Stats
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl p-4 border border-teal-500/20" style={{ background: "rgba(20,184,166,0.10)" }}>
                        <motion.p
                          animate={{ scale: [1, 1.06, 1] }}
                          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                          className="text-teal-300 font-black text-[36px] leading-none"
                          style={{ textShadow: "0 0 24px rgba(20,184,166,0.5)" }}
                        >
                          {dashMagnetSent}
                        </motion.p>
                        <p className="text-white/45 text-[11px] font-bold uppercase tracking-wide mt-2">Links Sent</p>
                        <p className="text-white/25 text-[10px] mt-0.5">people you linked to a post</p>
                      </div>
                      <div className="rounded-2xl p-4 border border-purple-500/20" style={{ background: "rgba(124,58,237,0.10)" }}>
                        <motion.p
                          animate={{ scale: [1, 1.06, 1] }}
                          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                          className="text-purple-300 font-black text-[36px] leading-none"
                          style={{ textShadow: "0 0 24px rgba(124,58,237,0.5)" }}
                        >
                          {dashMagnetReceived}
                        </motion.p>
                        <p className="text-white/45 text-[11px] font-bold uppercase tracking-wide mt-2">Links Received</p>
                        <p className="text-white/25 text-[10px] mt-0.5">times you were linked in</p>
                      </div>
                    </div>
                    {!dashMagnetFetched && (
                      <div className="flex justify-center py-6">
                        <div className="w-5 h-5 border-2 border-teal-400/30 border-t-teal-400 rounded-full animate-spin" />
                      </div>
                    )}
                    {dashMagnetFetched && dashMagnetSent === 0 && dashMagnetReceived === 0 && (
                      <div className="text-center py-6">
                        <p className="text-4xl mb-2">🧲</p>
                        <p className="text-white/30 text-[12px] font-bold">No viral links yet</p>
                        <p className="text-white/20 text-[11px] mt-1">Use the Link button on any post to start a chain</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;
