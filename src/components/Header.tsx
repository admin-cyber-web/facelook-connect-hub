import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bell, Search, X, UserPlus, Home, Settings, Loader2,
  Heart, Users, FileText, MessageCircle, UserCheck, UserX,
  CheckCheck, AtSign, Check, Link2, Flame, Zap,
  MapPin, BookOpen, Phone,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ───────────────────────────────────────────────────────────────────────
interface FriendEntry {
  friendshipId: string;
  id: string;
  full_name: string;
  avatar_url?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "abhi";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

const NOTIF_META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  like:            { icon: <Heart size={13} fill="currentColor" />,    color: "bg-red-500/20 text-red-400",    label: "ne like kiya" },
  comment:         { icon: <MessageCircle size={13} />,                color: "bg-green-500/20 text-green-400", label: "ne comment kiya" },
  follow:          { icon: <UserPlus size={13} />,                     color: "bg-purple-500/20 text-purple-400", label: "ne follow kiya" },
  friend_request:  { icon: <UserPlus size={13} />,                     color: "bg-blue-500/20 text-blue-400",  label: "ne friend request bheji" },
  friend_accepted: { icon: <UserCheck size={13} />,                    color: "bg-teal-500/20 text-teal-400",  label: "ne friend request accept ki" },
  circle_join:     { icon: <Users size={13} />,                        color: "bg-yellow-500/20 text-yellow-400", label: "aapke circle mein join hua" },
  new_post:        { icon: <FileText size={13} />,                     color: "bg-gray-500/20 text-gray-400",  label: "ne naya post kiya" },
  mention:         { icon: <AtSign size={13} />,                       color: "bg-orange-500/20 text-orange-400", label: "ne mention kiya" },
};

// ── Scramble config ────────────────────────────────────────────────────────────
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#@!%&$";
const WORD = ["F", "l", "i", "c", "k", "s"] as const;
const SCRAMBLE_STEPS = 10;
const STEP_MS       = 50;
const STAGGER_MS    = 75;

const FlicksLogo = () => {
  const [letters, setLetters] = useState<string[]>(() =>
    WORD.map(() => CHARS[Math.floor(Math.random() * CHARS.length)])
  );
  const [showBullet, setShowBullet] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    WORD.forEach((finalChar, idx) => {
      const start = idx * STAGGER_MS;
      for (let step = 0; step <= SCRAMBLE_STEPS; step++) {
        const t = setTimeout(() => {
          setLetters((prev) => {
            const next = [...prev];
            next[idx] = step === SCRAMBLE_STEPS ? finalChar : CHARS[Math.floor(Math.random() * CHARS.length)];
            return next;
          });
          if (idx === WORD.length - 1 && step === SCRAMBLE_STEPS) {
            setTimeout(() => { setShowBullet(true); setTimeout(() => setShowBullet(false), 700); }, 40);
          }
        }, start + step * STEP_MS);
        timers.push(t);
      }
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="relative flex flex-col items-start select-none leading-none">
      <div className="relative flex items-baseline gap-0">
        {WORD.map((_, i) => (
          <span key={i} className="text-[18px] sm:text-[20px] font-black tracking-tight tabular-nums"
            style={{ color: i < 4 ? "#ffffff" : "#60a5fa", textShadow: i < 4 ? "0 0 10px rgba(255,255,255,0.18)" : "0 0 10px rgba(96,165,250,0.45)", minWidth: "0.55em", display: "inline-block", textAlign: "center" }}>
            {letters[i]}
          </span>
        ))}
        <AnimatePresence>
          {showBullet && (
            <motion.div key="bullet" initial={{ scaleX: 0, opacity: 1 }} animate={{ scaleX: 1, opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
              className="absolute left-0 right-0 pointer-events-none"
              style={{ top: "50%", height: "2px", transformOrigin: "left center", background: "linear-gradient(90deg, transparent 0%, #60a5fa 30%, #ffffff 50%, #60a5fa 70%, transparent 100%)", boxShadow: "0 0 8px 2px rgba(96,165,250,0.7)" }} />
          )}
        </AnimatePresence>
      </div>
      <p className="text-[7px] sm:text-[8px] font-black tracking-[0.22em] text-white/40 uppercase mt-0.5">Made in India</p>
    </div>
  );
};

const TirangaFlag = () => (
  <motion.span animate={{ rotate: [0, -5, 5, -3, 3, -1, 1, 0] }} transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1.2, ease: "easeInOut" }}
    style={{ display: "inline-block", transformOrigin: "50% 100%", fontSize: "20px", lineHeight: 1 }} className="select-none">
    🇮🇳
  </motion.span>
);

const CIRCLE_GRADS = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#8b5cf6"];
function circleGrad(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h) ^ id.charCodeAt(i);
  return CIRCLE_GRADS[Math.abs(h) % CIRCLE_GRADS.length];
}

// ── Search Modal ───────────────────────────────────────────────────────────────
const SearchModal = ({ onClose, userId }: { onClose: () => void; userId?: string }) => {
  const [query, setQuery]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [people, setPeople]     = useState<any[]>([]);
  const [circles, setCircles]   = useState<any[]>([]);
  const [posts, setPosts]       = useState<any[]>([]);
  const [sugPeople, setSugPeople]   = useState<any[]>([]);
  const [sugCircles, setSugCircles] = useState<any[]>([]);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
    (async () => {
      const queries: Promise<any>[] = [
        supabase.from("profiles").select("id,full_name,avatar_url,fame_points").order("fame_points", { ascending: false }).limit(8)
          .then(r => r.error?.code === "42703" ? supabase.from("profiles").select("id,full_name,avatar_url").limit(8) : r),
        supabase.from("groups").select("id,name,cover_url,member_count").order("member_count", { ascending: false }).limit(8),
      ];
      if (userId) queries.push(supabase.from("friend_requests").select("receiver_id").eq("sender_id", userId));
      const [{ data: p }, { data: c }, reqRes] = await Promise.all(queries);
      setSugPeople(((p || []) as any[]).filter((x: any) => x.id !== userId).map((x: any) => ({ ...x, fame_points: x.fame_points ?? 0 })));
      setSugCircles(c || []);
      if (reqRes?.data) setSentRequests(new Set(reqRes.data.map((r: any) => r.receiver_id)));
    })();
  }, [userId]);

  const handleAddFriend = async (e: React.MouseEvent, personId: string) => {
    e.stopPropagation();
    if (!userId || sentRequests.has(personId)) return;
    setSentRequests((prev) => new Set([...prev, personId]));
    const { error } = await supabase.from("friendships").insert({ sender_id: userId, receiver_id: personId, status: "pending" });
    if (error) {
      if (!error.message?.includes("duplicate") && !error.message?.includes("unique")) {
        setSentRequests((prev) => { const n = new Set(prev); n.delete(personId); return n; });
        toast.error("Friend request nahi bheji ja saki.");
      }
      return;
    }
    await supabase.from("notifications").insert({ notifier_id: personId, actor_id: userId, type: "friend_request", entity_id: personId, content: "ne aapko friend request bheji", is_read: false });
  };

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setPeople([]); setCircles([]); setPosts([]); return; }
    setLoading(true);
    const like = `%${q.trim()}%`;
    const [{ data: p }, { data: c }, { data: ps }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,avatar_url,fame_points").ilike("full_name", like).limit(10),
      supabase.from("groups").select("id,name,cover_url,member_count,privacy").ilike("name", like).limit(8),
      supabase.from("posts").select("id,content,author,media_url,likes_count").ilike("content", like).limit(6),
    ]);
    setPeople((p || []).filter((x: any) => x.id !== userId));
    setCircles(c || []);
    setPosts(ps || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { const t = setTimeout(() => doSearch(query), 300); return () => clearTimeout(t); }, [query, doSearch]);

  const isSearching = query.trim().length > 0;
  const noResults   = isSearching && !loading && people.length + circles.length + posts.length === 0;

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const AddBtn = ({ id }: { id: string }) => (
    <button onClick={(e) => handleAddFriend(e, id)} disabled={sentRequests.has(id)}
      className={`px-4 py-2.5 rounded-xl text-sm font-extrabold active:scale-95 transition-all shrink-0 ${sentRequests.has(id) ? "bg-white/10 text-white/40" : "text-white shadow-lg"}`}
      style={sentRequests.has(id) ? {} : { background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)", boxShadow: "0 4px 14px rgba(79,70,229,0.5)" }}>
      {sentRequests.has(id) ? "Requested" : "+ Add Friend"}
    </button>
  );

  return (
    <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="fixed inset-0 z-[200] flex flex-col" style={{ background: "rgba(10,14,28,0.97)", backdropFilter: "blur(24px)" }}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/5">
        <Search size={18} className="text-blue-400 shrink-0" />
        <input ref={inputRef} type="text" placeholder="Search people, circles, posts…" value={query}
          onChange={e => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-white text-[15px] font-semibold outline-none placeholder:text-white/25" />
        {loading && <Loader2 size={16} className="text-blue-400 animate-spin shrink-0" />}
        <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl text-white/50 hover:text-white transition-all shrink-0"><X size={20} /></button>
      </div>
      <div className="flex-1 overflow-y-auto pb-10">
        {noResults && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-white/20">
            <Search size={40} strokeWidth={1.5} />
            <p className="text-[11px] font-black uppercase tracking-widest">No results for "{query}"</p>
          </div>
        )}
        {isSearching && !noResults && (
          <>
            {people.length > 0 && (
              <div className="pt-5">
                <div className="flex items-center gap-2 px-4 mb-3"><Users size={12} className="text-blue-400" /><p className="text-[10px] font-black text-white/40 uppercase tracking-widest">People</p></div>
                {people.map(person => (
                  <div key={person.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors">
                    <div className="w-11 h-11 rounded-full bg-blue-600 overflow-hidden border border-white/10 shrink-0">
                      {person.avatar_url ? <img src={person.avatar_url} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-white font-black text-sm">{person.full_name?.[0]}</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-[13px] truncate">{person.full_name}</p>
                      {(person.fame_points || 0) > 0 && <p className="text-yellow-400/60 text-[10px]">⭐ {person.fame_points} fame</p>}
                    </div>
                    <AddBtn id={person.id} />
                  </div>
                ))}
              </div>
            )}
            {circles.length > 0 && (
              <div className="pt-5">
                <div className="flex items-center gap-2 px-4 mb-3"><Users size={12} className="text-purple-400" /><p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Circles</p></div>
                {circles.map(circle => (
                  <div key={circle.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors">
                    <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-white/10" style={{ background: circleGrad(circle.id) }}>
                      {circle.cover_url && <img src={circle.cover_url} className="w-full h-full object-cover" alt="" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-[13px] truncate">{circle.name}</p>
                      <p className="text-white/40 text-[10px]">{circle.member_count ?? 0} members · {circle.privacy || "public"}</p>
                    </div>
                    <button className="px-3 py-1.5 bg-purple-600 rounded-xl text-[10px] font-black text-white active:scale-95 transition-transform shrink-0">Join</button>
                  </div>
                ))}
              </div>
            )}
            {posts.length > 0 && (
              <div className="pt-5">
                <div className="flex items-center gap-2 px-4 mb-3"><FileText size={12} className="text-green-400" /><p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Posts</p></div>
                {posts.map(post => (
                  <div key={post.id} className="px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors">
                    <p className="text-white/40 text-[10px] mb-1 font-semibold">@{post.author}</p>
                    <p className="text-white/80 text-[13px] leading-snug line-clamp-2">{post.content}</p>
                    {post.media_url && <div className="mt-2 w-16 h-12 rounded-lg overflow-hidden bg-white/5"><img src={post.media_url} className="w-full h-full object-cover" loading="lazy" alt="" /></div>}
                    <div className="flex items-center gap-1 mt-1.5"><Heart size={10} className="text-red-400" /><span className="text-white/30 text-[10px] font-semibold">{post.likes_count || 0}</span></div>
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
                <div className="flex items-center gap-2 px-4 mb-3"><span className="text-[12px]">🔥</span><p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Suggested People</p></div>
                {sugPeople.map(person => (
                  <div key={person.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors">
                    <div className="w-11 h-11 rounded-full bg-blue-600 overflow-hidden border border-white/10 shrink-0">
                      {person.avatar_url ? <img src={person.avatar_url} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-white font-black text-sm">{person.full_name?.[0]}</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-[13px] truncate">{person.full_name}</p>
                      {(person.fame_points || 0) > 0 && <p className="text-yellow-400/60 text-[10px]">⭐ {person.fame_points} fame</p>}
                    </div>
                    <AddBtn id={person.id} />
                  </div>
                ))}
              </div>
            )}
            {sugCircles.length > 0 && (
              <div className="pt-5">
                <div className="flex items-center gap-2 px-4 mb-3"><span className="text-[12px]">👥</span><p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Popular Circles</p></div>
                {sugCircles.map(circle => (
                  <div key={circle.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors">
                    <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-white/10" style={{ background: circleGrad(circle.id) }}>
                      {circle.cover_url && <img src={circle.cover_url} className="w-full h-full object-cover" alt="" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-[13px] truncate">{circle.name}</p>
                      <p className="text-white/40 text-[10px]">{circle.member_count ?? 0} members</p>
                    </div>
                    <button className="px-3 py-1.5 bg-white/10 border border-white/15 rounded-xl text-[10px] font-black text-white/70 active:scale-95 transition-transform shrink-0">Join</button>
                  </div>
                ))}
              </div>
            )}
            {sugPeople.length === 0 && sugCircles.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-white/20">
                <Search size={40} strokeWidth={1.5} />
                <p className="text-[11px] font-black uppercase tracking-widest">Start typing to search</p>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
};

// ── Actor Avatar ────────────────────────────────────────────────────────────────
const ActorAvatar = ({ name, avatarUrl, size = 36 }: { name: string; avatarUrl?: string; size?: number }) => (
  <div className="rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-black shrink-0 border-2 border-white/10"
    style={{ width: size, height: size, fontSize: size * 0.38 }}>
    {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" alt="" /> : (name?.[0] || "?").toUpperCase()}
  </div>
);

// ── Stat Pill ───────────────────────────────────────────────────────────────────
type DashTab = "posts" | "hooks" | "likes" | "friends";
const DASH_TABS: { key: DashTab; label: string; icon: React.ReactNode; color: string; glow: string }[] = [
  { key: "posts",   label: "Posts",   icon: <FileText size={15} />, color: "from-indigo-500 to-blue-600",   glow: "rgba(99,102,241,0.5)"  },
  { key: "hooks",   label: "Hooks",   icon: <Link2 size={15} />,    color: "from-purple-500 to-fuchsia-600", glow: "rgba(168,85,247,0.5)" },
  { key: "likes",   label: "Likes",   icon: <Heart size={15} />,    color: "from-rose-500 to-pink-600",     glow: "rgba(244,63,94,0.5)"  },
  { key: "friends", label: "Friends", icon: <Users size={15} />,    color: "from-emerald-500 to-teal-600",  glow: "rgba(16,185,129,0.5)" },
];

// ── Main Header ────────────────────────────────────────────────────────────────
const Header = ({
  onProfileClick,
  onHomeClick,
  onSettingsClick,
  userId,
}: {
  onProfileClick?: () => void;
  onHomeClick?: () => void;
  onSettingsClick?: () => void;
  userId?: string;
}) => {
  // ── Existing state ─────────────────────────────────────────────────────────
  const [notifications, setNotifications]   = useState<any[]>([]);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [showNotif, setShowNotif]           = useState(false);
  const [showSearch, setShowSearch]         = useState(false);
  const [actionLoading, setActionLoading]   = useState<string | null>(null);
  const [userData, setUserData] = useState({ full_name: "...", avatar_url: "", id: userId || "", bio: "", school: "", mobile: "", location: "" });

  // ── Power Dashboard state ──────────────────────────────────────────────────
  const [showDash, setShowDash]       = useState(false);
  const [dashTab, setDashTab]         = useState<DashTab>("friends");
  const [dashStats, setDashStats]     = useState({ posts: 0, hooks: 0, likes: 0, friends: 0 });
  const [dashLoading, setDashLoading] = useState(false);
  const [dashFriends, setDashFriends]         = useState<FriendEntry[]>([]);
  const [dashFriendsLoading, setDashFriendsLoading] = useState(false);
  const [dashPosts, setDashPosts]             = useState<any[]>([]);
  const [dashHooks, setDashHooks]             = useState<any[]>([]);
  const [dashPostsFetched, setDashPostsFetched] = useState(false);
  const [dashHooksFetched, setDashHooksFetched] = useState(false);

  // ── KICK state ─────────────────────────────────────────────────────────────
  const [kickTarget, setKickTarget]   = useState<FriendEntry | null>(null);
  const [kickingId, setKickingId]     = useState<string | null>(null);

  // ── Fetchers ──────────────────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from("profiles").select("full_name, avatar_url, bio, school, mobile, location").eq("id", userId).single();
    if (data) setUserData(prev => ({ ...prev, ...data }));
  }, [userId]);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("notifications").select("*").eq("notifier_id", userId)
      .order("created_at", { ascending: false }).limit(30);
    if (data && data.length > 0) {
      const actorIds = [...new Set(data.filter(n => n.actor_id).map(n => n.actor_id))];
      let profileMap: Record<string, any> = {};
      if (actorIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", actorIds);
        profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
      }
      setNotifications(data.map(n => ({ ...n, actor: profileMap[n.actor_id] || null })));
    } else {
      setNotifications([]);
    }
  }, [userId]);

  const fetchFriendRequests = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from("friendships").select("*").eq("receiver_id", userId).eq("status", "pending").order("created_at", { ascending: false });
    if (data && data.length > 0) {
      const senderIds = [...new Set(data.map(r => r.sender_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", senderIds);
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
      setFriendRequests(data.map(r => ({ ...r, sender: profileMap[r.sender_id] || null })));
    } else {
      setFriendRequests([]);
    }
  }, [userId]);

  // ── Dashboard Fetchers ─────────────────────────────────────────────────────
  const fetchDashStats = useCallback(async () => {
    if (!userId) return;
    setDashLoading(true);
    const [postsRes, hooksRes, friendsRes, postsLikesRes] = await Promise.all([
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", userId),
      supabase.from("page_followers").select("page_id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("friendships").select("id", { count: "exact", head: true }).or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).eq("status", "accepted"),
      supabase.from("posts").select("likes_count").eq("author_id", userId),
    ]);
    const totalLikes = (postsLikesRes.data || []).reduce((sum: number, p: any) => sum + (p.likes_count || 0), 0);
    setDashStats({
      posts:   postsRes.count ?? 0,
      hooks:   hooksRes.count ?? 0,
      likes:   totalLikes,
      friends: friendsRes.count ?? 0,
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

    console.log("[PowerDash] friendships rows:", rows?.length ?? 0, "| error:", error ?? "none");

    if (!rows || rows.length === 0) {
      setDashFriends([]);
      setDashFriendsLoading(false);
      return;
    }

    // Step 2: collect the friend's profile ids (the "other" person)
    const friendIds = rows.map((r: any) => r.sender_id === userId ? r.receiver_id : r.sender_id);
    console.log("[PowerDash] friendIds to fetch profiles for:", friendIds);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", friendIds);

    console.log("[PowerDash] profiles fetched:", profiles?.length ?? 0);

    const profileMap: Record<string, any> = Object.fromEntries((profiles || []).map(p => [p.id, p]));

    const parsed: FriendEntry[] = rows.map((r: any) => {
      const friendId = r.sender_id === userId ? r.receiver_id : r.sender_id;
      const p = profileMap[friendId];
      return p ? { friendshipId: r.id, id: p.id, full_name: p.full_name, avatar_url: p.avatar_url } : null;
    }).filter((f): f is FriendEntry => !!f && !!f.id);

    console.log("[PowerDash] parsed friends:", parsed.length);
    setDashFriends(parsed);
    setDashFriendsLoading(false);
  }, [userId]);

  const fetchDashPosts = useCallback(async () => {
    if (!userId || dashPostsFetched) return;
    const { data } = await supabase.from("posts").select("id,content,media_url,likes_count,created_at").eq("author_id", userId).order("created_at", { ascending: false }).limit(10);
    setDashPosts(data || []);
    setDashPostsFetched(true);
  }, [userId, dashPostsFetched]);

  const fetchDashHooks = useCallback(async () => {
    if (!userId || dashHooksFetched) return;
    const { data } = await supabase.from("page_followers").select("page_id, hook_pages(id,name,avatar_url,follower_count,followers_count)").eq("user_id", userId).limit(20);
    setDashHooks(data || []);
    setDashHooksFetched(true);
  }, [userId, dashHooksFetched]);

  // ── KICK Logic ─────────────────────────────────────────────────────────────
  const confirmKick = async () => {
    if (!kickTarget || kickingId) return;
    const target = kickTarget;
    setKickTarget(null);
    setKickingId(target.id);

    await supabase.from("friendships").delete().eq("id", target.friendshipId);

    setTimeout(() => {
      setDashFriends(prev => prev.filter(f => f.id !== target.id));
      setDashStats(prev => ({ ...prev, friends: Math.max(0, prev.friends - 1) }));
      setKickingId(null);
    }, 650);

    toast(
      <div className="flex items-center gap-2 font-bold text-sm">
        <span className="text-2xl">⚽</span>
        <span>Chal hat hawa aane de... Kicked out of the field!</span>
      </div>,
      {
        duration: 3500,
        style: { background: "#1a1a2e", color: "#fff", border: "1.5px solid #ef4444", borderRadius: "14px", fontFamily: "inherit" },
      }
    );
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const acceptRequest = async (reqId: string, senderId: string) => {
    setActionLoading(reqId);
    const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", reqId);
    if (error) { toast.error("Request accept nahi ho saki: " + error.message); setActionLoading(null); return; }
    await supabase.from("notifications").insert({ notifier_id: senderId, actor_id: userId, type: "friend_accepted", entity_id: reqId, content: `${userData.full_name} ne aapki friend request accept ki`, is_read: false });
    toast.success("Friend request accept ho gayi!");
    setFriendRequests(prev => prev.filter(r => r.id !== reqId));
    setActionLoading(null);
  };

  const rejectRequest = async (reqId: string) => {
    setActionLoading(reqId + "_reject");
    await supabase.from("friendships").update({ status: "rejected" }).eq("id", reqId);
    setFriendRequests(prev => prev.filter(r => r.id !== reqId));
    setActionLoading(null);
  };

  const markAllRead = async () => {
    if (!userId) return;
    await supabase.from("notifications").update({ is_read: true }).eq("notifier_id", userId).eq("is_read", false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const markOneRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const playNotifSound = () => {
    try { const audio = new Audio("/notif.wav"); audio.volume = 1.0; audio.play().catch(() => {}); } catch {}
  };

  const handleNotifClick = (n: any) => {
    if (!n.is_read) markOneRead(n.id);
    const postTypes = ["like","comment","mention","new_post"];
    if (n.entity_id && postTypes.includes(n.type)) {
      setShowNotif(false); onHomeClick?.();
      setTimeout(() => {
        const el = document.getElementById(n.entity_id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.style.outline = "2px solid #3b82f6"; el.style.borderRadius = "16px";
          setTimeout(() => { el.style.outline = ""; el.style.borderRadius = ""; }, 2200);
        }
      }, 420);
    }
  };

  // ── Real-time setup ────────────────────────────────────────────────────────
  const fetchNotifsRef     = useRef(fetchNotifications);
  const fetchFriendReqsRef = useRef(fetchFriendRequests);
  useEffect(() => { fetchNotifsRef.current     = fetchNotifications; }, [fetchNotifications]);
  useEffect(() => { fetchFriendReqsRef.current = fetchFriendRequests; }, [fetchFriendRequests]);

  useEffect(() => {
    if (!userId) return;
    fetchProfile();
    fetchNotifsRef.current();
    fetchFriendReqsRef.current();

    const notifCh = supabase.channel(`notif-live-v2-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, (payload) => {
        const row = (payload.new || payload.old) as any;
        if (row?.notifier_id !== userId) return;
        if (payload.eventType === "INSERT") playNotifSound();
        fetchNotifsRef.current();
      }).subscribe();

    const friendCh = supabase.channel(`friend-live-v2-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, (payload) => {
        const row = (payload.new || payload.old) as any;
        if (row?.receiver_id !== userId) return;
        fetchFriendReqsRef.current();
      }).subscribe();

    return () => { supabase.removeChannel(notifCh); supabase.removeChannel(friendCh); };
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
      if (url) setUserData(prev => ({ ...prev, avatar_url: url }));
    };
    const profileHandler = () => { fetchProfile(); };
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
    if (dashTab === "posts")   fetchDashPosts();
    if (dashTab === "hooks")   fetchDashHooks();
  }, [dashTab, showDash, fetchDashFriends, fetchDashPosts, fetchDashHooks]);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const totalBadge  = unreadCount + friendRequests.length;
  const hasAnything = notifications.length > 0 || friendRequests.length > 0;

  return (
    <>
      {/* ── GLASS HEADER ─────────────────────────────────────────────────── */}
      <header className="w-full h-14 bg-white/10 backdrop-blur-2xl border-b border-white/10 sticky top-0 z-[100] px-3 sm:px-5 flex items-center gap-3 transition-all relative overflow-hidden">
        <div className="flex items-center gap-2 flex-shrink-0">
          <motion.div animate={{ rotate: [0, -8, 8, -4, 4, 0] }} transition={{ duration: 3.5, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
            className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0">
            <span className="text-white font-black text-[12px] italic">F</span>
          </motion.div>
          <FlicksLogo />
          <TirangaFlag />
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 flex-shrink-0">
          <motion.button whileTap={{ scale: 0.88 }} onClick={onHomeClick}
            className="p-2 bg-white/10 border border-white/15 text-white rounded-xl hover:bg-white/15 transition-all active:scale-90 flex-shrink-0">
            <Home size={17} />
          </motion.button>
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShowSearch(true)}
            className="p-2 bg-white/10 border border-white/15 text-white rounded-xl hover:bg-blue-500/20 hover:border-blue-500/40 transition-all active:scale-90 flex-shrink-0">
            <Search size={17} />
          </motion.button>
          <motion.button whileTap={{ scale: 0.9 }}
            onClick={() => { setShowNotif(v => !v); if (!showNotif) fetchFriendRequests(); }}
            className="p-2.5 bg-white/5 border border-white/10 text-white rounded-2xl relative hover:bg-white/10 transition-all flex-shrink-0">
            <Bell size={18} className="drop-shadow-md" />
            {totalBadge > 0 && (
              <motion.span key={totalBadge} initial={{ scale: 0.5 }} animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-slate-900 px-0.5">
                {totalBadge > 99 ? "99+" : totalBadge}
              </motion.span>
            )}
          </motion.button>
          <motion.button whileTap={{ scale: 0.88 }} onClick={onSettingsClick}
            className="p-2 bg-white/10 border border-white/15 text-white rounded-xl hover:bg-white/15 transition-all active:scale-90 flex-shrink-0">
            <Settings size={17} />
          </motion.button>

          {/* Avatar → opens Power Dashboard */}
          <motion.div whileTap={{ scale: 0.88 }} onClick={() => { setShowDash(true); setDashFriends([]); }}
            className="w-9 h-9 rounded-xl overflow-hidden border-2 border-yellow-400/60 shadow-lg cursor-pointer flex-shrink-0 relative"
            style={{ boxShadow: "0 0 12px rgba(250,204,21,0.35)" }}>
            {userData.avatar_url
              ? <img src={userData.avatar_url} loading="lazy" className="w-full h-full object-cover" alt="Profile" />
              : <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white font-black text-xs">{userData.full_name[0]}</div>}
          </motion.div>
        </div>
      </header>

      {/* ── SEARCH MODAL ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSearch && <SearchModal onClose={() => setShowSearch(false)} userId={userId} />}
      </AnimatePresence>

      {/* ── NOTIFICATIONS DRAWER ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showNotif && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowNotif(false)}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[105]" />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="fixed top-0 right-0 h-full w-full max-w-sm bg-slate-900/90 backdrop-blur-3xl shadow-2xl z-[110] border-l border-white/10 flex flex-col overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between border-b border-white/10 bg-white/5 shrink-0">
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-white/70" />
                  <h2 className="font-black text-white tracking-wide text-[13px]">Notifications</h2>
                  {unreadCount > 0 && <span className="px-1.5 py-0.5 bg-red-500/80 rounded-full text-[9px] font-black text-white">{unreadCount}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/60 hover:text-white text-[10px] font-bold transition-all">
                      <CheckCheck size={11} /> Mark all read
                    </button>
                  )}
                  <button onClick={() => setShowNotif(false)} className="p-1.5 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-all"><X size={18} /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {!hasAnything ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-white/20 py-16">
                    <Bell size={44} strokeWidth={1} />
                    <p className="text-[11px] font-black uppercase tracking-widest">Koi notification nahi</p>
                  </div>
                ) : (
                  <div className="p-3 space-y-2">
                    {friendRequests.length > 0 && (
                      <div>
                        <p className="text-[9px] font-black text-white/30 uppercase tracking-widest px-1 mb-1.5">Friend Requests · {friendRequests.length}</p>
                        {friendRequests.map(req => {
                          const sender = req.sender || {};
                          const isAccLoading = actionLoading === req.id;
                          const isRejLoading = actionLoading === req.id + "_reject";
                          return (
                            <motion.div key={req.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-blue-600/10 border border-blue-500/20 rounded-2xl mb-2">
                              <div className="flex items-center gap-3">
                                <ActorAvatar name={sender.full_name || "?"} avatarUrl={sender.avatar_url} size={40} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[12px] font-black text-white leading-tight truncate">{sender.full_name || "Koi user"}</p>
                                  <p className="text-[10px] text-white/40 mt-0.5">ne friend request bheji</p>
                                </div>
                                <p className="text-[9px] text-white/30 shrink-0">{req.created_at ? timeAgo(req.created_at) : ""}</p>
                              </div>
                              <div className="flex gap-2 mt-2.5">
                                <motion.button whileTap={{ scale: 0.95 }} onClick={() => acceptRequest(req.id, req.sender_id)} disabled={isAccLoading || isRejLoading}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black transition-all disabled:opacity-50">
                                  {isAccLoading ? <Loader2 size={12} className="animate-spin" /> : <><UserCheck size={12} /> Confirm</>}
                                </motion.button>
                                <motion.button whileTap={{ scale: 0.95 }} onClick={() => rejectRequest(req.id)} disabled={isAccLoading || isRejLoading}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/70 text-[11px] font-black transition-all disabled:opacity-50">
                                  {isRejLoading ? <Loader2 size={12} className="animate-spin" /> : <><UserX size={12} /> Delete</>}
                                </motion.button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                    {notifications.length > 0 && (
                      <div>
                        {friendRequests.length > 0 && <p className="text-[9px] font-black text-white/30 uppercase tracking-widest px-1 mb-1.5 mt-3">Activity</p>}
                        {notifications.map((n, i) => {
                          const meta = NOTIF_META[n.type] || NOTIF_META["new_post"];
                          const actor = n.actor || {};
                          const actorName = actor.full_name || n.actor_name || "Koi user";
                          const bodyText = n.content ? n.content.replace(actorName, "").trim() : meta.label;
                          const isNavigable = n.entity_id && ["like","comment","mention","new_post"].includes(n.type);
                          return (
                            <motion.div key={n.id} initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{ delay: i * 0.04, type: "spring", stiffness: 260, damping: 22 }}
                              onClick={() => handleNotifClick(n)}
                              className={`flex items-start gap-3.5 p-4 rounded-2xl mb-2 cursor-pointer transition-all active:scale-[0.98] ${n.is_read ? "bg-white/[0.04] hover:bg-white/[0.07]" : "bg-gradient-to-r from-blue-600/15 via-blue-500/10 to-transparent border border-blue-500/20 hover:from-blue-600/20 shadow-sm"}`}>
                              <div className="relative shrink-0">
                                <ActorAvatar name={actorName} avatarUrl={actor.avatar_url} size={46} />
                                <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center shadow-lg ${meta.color}`}>{meta.icon}</div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[14px] font-black text-white leading-tight truncate">{actorName}</p>
                                <p className="text-[13px] font-semibold text-white/70 mt-0.5 leading-snug line-clamp-2">{bodyText}</p>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <p className="text-[10px] text-white/35 font-semibold">{n.created_at ? timeAgo(n.created_at) : ""}</p>
                                  {isNavigable && <span className="text-[9px] text-blue-400/70 font-black uppercase tracking-wide">· Post dekho →</span>}
                                </div>
                              </div>
                              {!n.is_read && (
                                <div className="relative shrink-0 mt-1">
                                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                  <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-60" />
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setShowDash(false); setKickTarget(null); setDashFriends([]); }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[115]" />

            {/* Sidebar */}
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 210 }}
              className="fixed top-0 right-0 h-full w-full max-w-sm z-[120] flex flex-col overflow-hidden"
              style={{ background: "linear-gradient(160deg, #0f0c29 0%, #141428 50%, #0a0a1a 100%)", borderLeft: "1px solid rgba(255,255,255,0.08)" }}>

              {/* ── Dashboard Header ─────────────────────────────────────── */}
              <div className="relative px-5 pt-5 pb-4 shrink-0" style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.25) 0%, rgba(79,70,229,0.15) 100%)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                {/* Close */}
                <button onClick={() => { setShowDash(false); setKickTarget(null); setDashFriends([]); }}
                  className="absolute top-4 right-4 p-1.5 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-all">
                  <X size={18} />
                </button>

                {/* Profile card */}
                <div className="flex gap-3 mb-4">
                  {/* Avatar */}
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 shrink-0 self-start"
                    style={{ borderColor: "rgba(250,204,21,0.5)", boxShadow: "0 0 18px rgba(250,204,21,0.3)" }}>
                    {userData.avatar_url
                      ? <img src={userData.avatar_url} className="w-full h-full object-cover" alt="" />
                      : <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl">{userData.full_name[0]}</div>}
                  </div>

                  {/* Name + bio + meta */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-white font-black text-[16px] truncate leading-tight">{userData.full_name}</p>

                    <div className="flex items-center gap-1.5">
                      <Zap size={10} className="text-yellow-400" />
                      <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: "#facc15", textShadow: "0 0 8px rgba(250,204,21,0.6)" }}>Power Dashboard</span>
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
                          <span className="truncate max-w-[100px]">{userData.school}</span>
                        </span>
                      ) : null}
                      {userData.location ? (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-white/50 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">
                          <MapPin size={9} className="text-rose-400" />
                          <span className="truncate max-w-[90px]">{userData.location}</span>
                        </span>
                      ) : null}
                      {userData.mobile ? (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-white/50 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">
                          <Phone size={9} className="text-green-400" />
                          <span className="truncate max-w-[90px]">{userData.mobile}</span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* ── 4 Stat Pills ─────────────────────────────────────── */}
                <div className="grid grid-cols-4 gap-2">
                  {DASH_TABS.map(tab => (
                    <motion.button key={tab.key} whileTap={{ scale: 0.92 }} onClick={() => setDashTab(tab.key)}
                      className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-2xl border transition-all ${dashTab === tab.key ? "border-white/20" : "border-white/8 hover:border-white/15"}`}
                      style={dashTab === tab.key ? { background: `linear-gradient(135deg, ${tab.color.includes("indigo") ? "rgba(99,102,241,0.35)" : tab.color.includes("purple") ? "rgba(168,85,247,0.35)" : tab.color.includes("rose") ? "rgba(244,63,94,0.35)" : "rgba(16,185,129,0.35)"})`, boxShadow: `0 4px 16px ${tab.glow}` } : { background: "rgba(255,255,255,0.05)" }}>
                      <div className={`text-white/60 ${dashTab === tab.key ? "text-white" : ""}`}>{tab.icon}</div>
                      {dashLoading ? (
                        <div className="w-3 h-3 border border-white/30 border-t-white/80 rounded-full animate-spin" />
                      ) : (
                        <span className="text-white font-black text-[13px] leading-none">
                          {dashStats[tab.key] > 999 ? `${(dashStats[tab.key] / 1000).toFixed(1)}k` : dashStats[tab.key]}
                        </span>
                      )}
                      <span className={`text-[9px] font-black uppercase tracking-wide ${dashTab === tab.key ? "text-white/80" : "text-white/35"}`}>{tab.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* ── Tab Content ──────────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto relative">

                {/* ── KICK CONFIRMATION POPUP ─────────────────────────── */}
                <AnimatePresence>
                  {kickTarget && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 z-10 flex items-center justify-center px-5"
                      style={{ background: "rgba(10,10,26,0.88)", backdropFilter: "blur(12px)" }}>
                      <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85, y: 20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 22 }}
                        className="w-full rounded-3xl p-6 text-center"
                        style={{ background: "linear-gradient(145deg, #1a1a35, #12122a)", border: "1.5px solid rgba(239,68,68,0.4)", boxShadow: "0 20px 60px rgba(239,68,68,0.25)" }}>

                        <div className="text-5xl mb-3">⚽🥊</div>
                        <p className="text-white font-black text-[15px] leading-snug mb-1">
                          Bhai, kya aap sach mein
                        </p>
                        <p className="text-white font-black text-[15px] leading-snug mb-1">
                          <span className="text-yellow-400">{kickTarget.full_name}</span> ko
                        </p>
                        <p className="text-white font-black text-[15px] leading-snug mb-5">
                          bahar ka rasta dikha rahe hain?
                        </p>

                        <div className="flex gap-3">
                          <motion.button whileTap={{ scale: 0.94 }} onClick={confirmKick}
                            className="flex-1 py-3 rounded-2xl font-black text-[13px] text-white transition-all"
                            style={{ background: "linear-gradient(135deg, #dc2626, #b91c1c)", boxShadow: "0 6px 20px rgba(220,38,38,0.45)" }}>
                            💨 Ha, Chal hat hawa aane de!
                          </motion.button>
                          <motion.button whileTap={{ scale: 0.94 }} onClick={() => setKickTarget(null)}
                            className="flex-1 py-3 rounded-2xl font-black text-[13px] text-white/70 border border-white/15 hover:bg-white/10 transition-all">
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
                      <p className="text-[11px] font-black text-white/50 uppercase tracking-widest">Friends · {dashStats.friends}</p>
                      <span className="ml-auto text-[9px] text-red-400 font-black bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">⚽ Kick Mode ON</span>
                    </div>

                    {/* ── Skeleton loader ── */}
                    {dashFriendsLoading && (
                      <div className="flex flex-col gap-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="flex items-center gap-3 rounded-2xl px-3 py-3 animate-pulse"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div className="w-11 h-11 rounded-xl bg-white/10 shrink-0" />
                            <div className="flex-1 space-y-2">
                              <div className="h-3 bg-white/10 rounded-full w-3/4" />
                              <div className="h-2 bg-white/6 rounded-full w-1/2" />
                            </div>
                            <div className="w-20 h-9 rounded-xl bg-red-500/10 shrink-0" />
                          </div>
                        ))}
                        <p className="text-center text-white/30 text-[11px] font-bold mt-2">Loading friends...</p>
                      </div>
                    )}

                    {/* ── Empty state ── */}
                    {!dashFriendsLoading && dashFriends.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/20">
                        <Users size={36} strokeWidth={1} />
                        <p className="text-[11px] font-black uppercase tracking-widest">Koi dost nahi abhi</p>
                      </div>
                    )}

                    {/* ── Friends list ── */}
                    {!dashFriendsLoading && dashFriends.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <AnimatePresence>
                          {dashFriends.map(f => (
                            <motion.div key={f.id} layout
                              initial={{ opacity: 1, x: 0, rotate: 0 }}
                              animate={kickingId === f.id ? { x: 420, rotate: 18, opacity: 0, scale: 0.8 } : { opacity: 1, x: 0, rotate: 0, scale: 1 }}
                              exit={{ x: 420, rotate: 18, opacity: 0, scale: 0.8 }}
                              transition={kickingId === f.id ? { type: "spring", stiffness: 280, damping: 18 } : { duration: 0.2 }}
                              className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
                              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>

                              {/* Avatar */}
                              <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0" style={{ background: "linear-gradient(135deg, #1d4ed8, #4f46e5)" }}>
                                {f.avatar_url
                                  ? <img src={f.avatar_url} className="w-full h-full object-cover" alt={f.full_name} />
                                  : <div className="w-full h-full flex items-center justify-center text-white font-black text-base">{(f.full_name || "?")[0].toUpperCase()}</div>}
                              </div>

                              {/* Name */}
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-bold text-[14px] truncate">{f.full_name}</p>
                                <p className="text-emerald-400/60 text-[10px] font-semibold">✓ Friend</p>
                              </div>

                              {/* ── BIG BOLD KICK BUTTON ── */}
                              <motion.button
                                whileTap={{ scale: 0.82 }}
                                whileHover={{ scale: 1.08, boxShadow: "0 6px 24px rgba(239,68,68,0.55)" }}
                                onClick={() => setKickTarget(f)}
                                disabled={!!kickingId}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-[13px] tracking-widest uppercase transition-all disabled:opacity-40 shrink-0"
                                style={{
                                  border: "2px solid rgba(239,68,68,0.8)",
                                  color: "#fff",
                                  background: "linear-gradient(135deg, rgba(220,38,38,0.7), rgba(239,68,68,0.5))",
                                  boxShadow: "0 4px 16px rgba(239,68,68,0.35)",
                                  letterSpacing: "0.08em",
                                }}>
                                <span className="text-[17px] leading-none">⚽</span>
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
                      <p className="text-[11px] font-black text-white/50 uppercase tracking-widest">Your Posts · {dashStats.posts}</p>
                    </div>
                    {dashPosts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/20">
                        <FileText size={36} strokeWidth={1} />
                        <p className="text-[11px] font-black uppercase tracking-widest">Koi post nahi abhi</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {dashPosts.map(post => (
                          <div key={post.id} className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                            {post.media_url && (
                              <div className="w-full h-24 rounded-xl overflow-hidden mb-2 bg-white/5">
                                <img src={post.media_url} className="w-full h-full object-cover" loading="lazy" alt="" />
                              </div>
                            )}
                            {post.content && <p className="text-white/80 text-[13px] leading-snug line-clamp-3 mb-2">{post.content}</p>}
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1"><Heart size={11} className="text-red-400" /><span className="text-white/40 text-[10px] font-bold">{post.likes_count || 0}</span></div>
                              <span className="text-white/25 text-[10px]">{post.created_at ? timeAgo(post.created_at) : ""}</span>
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
                      <p className="text-[11px] font-black text-white/50 uppercase tracking-widest">Pages You Follow · {dashStats.hooks}</p>
                    </div>
                    {dashHooks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/20">
                        <Link2 size={36} strokeWidth={1} />
                        <p className="text-[11px] font-black uppercase tracking-widest">Koi page follow nahi kiya</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {dashHooks.map((item: any, i: number) => {
                          const page = item.hook_pages || {};
                          return (
                            <div key={item.page_id || i} className="flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                              <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0" style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}>
                                {page.avatar_url ? <img src={page.avatar_url} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-white font-black text-sm">{(page.name || "P")[0]}</div>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-bold text-[13px] truncate">{page.name || "Hook Page"}</p>
                                <p className="text-white/30 text-[10px]">{page.followers_count || page.follower_count || 0} followers</p>
                              </div>
                              <Link2 size={14} className="text-purple-400/50 shrink-0" />
                            </div>
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
                      <p className="text-[11px] font-black text-white/50 uppercase tracking-widest">Total Likes Received</p>
                    </div>
                    <div className="flex flex-col items-center justify-center py-8 mb-4">
                      <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        className="text-6xl mb-3">❤️</motion.div>
                      <p className="text-white font-black text-[48px] leading-none" style={{ textShadow: "0 0 30px rgba(244,63,94,0.6)" }}>{dashStats.likes}</p>
                      <p className="text-white/40 text-[12px] font-bold mt-2">total likes on your posts</p>
                    </div>
                    {dashPosts.length === 0 && (
                      <div className="text-center text-white/20 text-[11px] font-black uppercase tracking-widest py-4">Koi post nahi abhi</div>
                    )}
                    {dashPosts.length > 0 && (
                      <>
                        <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2">Top Liked Posts</p>
                        <div className="flex flex-col gap-2">
                          {[...dashPosts].sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0)).slice(0, 5).map(post => (
                            <div key={post.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                              <div className="flex items-center gap-1 shrink-0">
                                <Heart size={12} className="text-rose-400" fill="currentColor" />
                                <span className="text-rose-300 font-black text-[13px]">{post.likes_count || 0}</span>
                              </div>
                              <p className="text-white/70 text-[12px] line-clamp-1 flex-1 min-w-0">{post.content || "(image post)"}</p>
                            </div>
                          ))}
                        </div>
                      </>
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
