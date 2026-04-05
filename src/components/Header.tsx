import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Search, X, UserPlus, Home, Settings, Loader2, Heart, Users, FileText } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";

// ── Scramble config ────────────────────────────────────────────────────────────
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#@!%&$";
const WORD = ["F", "a", "c", "e", "l", "o", "o", "k"] as const;
const SCRAMBLE_STEPS = 10;   // random frames per letter before it settles
const STEP_MS       = 50;    // ms between each frame
const STAGGER_MS    = 75;    // ms offset between each letter's start

// ── Animated Facelook wordmark with scramble + bullet ─────────────────────────
const FacelookLogo = () => {
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
            next[idx] =
              step === SCRAMBLE_STEPS
                ? finalChar
                : CHARS[Math.floor(Math.random() * CHARS.length)];
            return next;
          });

          // Last letter just settled → fire the bullet
          if (idx === WORD.length - 1 && step === SCRAMBLE_STEPS) {
            setTimeout(() => {
              setShowBullet(true);
              setTimeout(() => setShowBullet(false), 700);
            }, 40);
          }
        }, start + step * STEP_MS);

        timers.push(t);
      }
    });

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="relative flex flex-col items-start select-none leading-none">
      {/* Letter row */}
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

        {/* ── Bullet / slider that sweeps across the centerline ── */}
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

      {/* Tagline */}
      <p className="text-[7px] sm:text-[8px] font-black tracking-[0.22em] text-white/40 uppercase mt-0.5">
        Made in India
      </p>
    </div>
  );
};

// ── Waving Indian flag ─────────────────────────────────────────────────────────
const TirangaFlag = () => (
  <motion.span
    animate={{ rotate: [0, -5, 5, -3, 3, -1, 1, 0] }}
    transition={{
      duration: 1.8,
      repeat: Infinity,
      repeatDelay: 1.2,
      ease: "easeInOut",
    }}
    style={{ display: "inline-block", transformOrigin: "50% 100%", fontSize: "20px", lineHeight: 1 }}
    className="select-none"
  >
    🇮🇳
  </motion.span>
);

// ── Search Result Helpers ──────────────────────────────────────────────────────
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

  // Auto-focus + load suggestions + existing requests
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
    (async () => {
      const queries: Promise<any>[] = [
        supabase.from("profiles").select("id,full_name,avatar_url,fame_points")
          .order("fame_points", { ascending: false }).limit(8),
        supabase.from("groups").select("id,name,cover_url,member_count")
          .order("member_count", { ascending: false }).limit(8),
      ];
      if (userId) {
        queries.push(supabase.from("friend_requests").select("receiver_id").eq("sender_id", userId));
      }
      const [{ data: p }, { data: c }, reqRes] = await Promise.all(queries);
      setSugPeople((p || []).filter((x: any) => x.id !== userId));
      setSugCircles(c || []);
      if (reqRes?.data) {
        setSentRequests(new Set(reqRes.data.map((r: any) => r.receiver_id)));
      }
    })();
  }, [userId]);

  const handleAddFriend = async (e: React.MouseEvent, personId: string) => {
    e.stopPropagation();
    if (!userId || sentRequests.has(personId)) return;
    setSentRequests((prev) => new Set([...prev, personId]));
    await supabase.from("friend_requests").insert({
      sender_id: userId,
      receiver_id: personId,
      status: "pending",
    });
  };

  // Debounced search
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

  useEffect(() => {
    const t = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  const isSearching = query.trim().length > 0;
  const noResults   = isSearching && !loading && people.length + circles.length + posts.length === 0;

  // Close on ESC
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="fixed inset-0 z-[200] flex flex-col"
      style={{ background: "rgba(10,14,28,0.97)", backdropFilter: "blur(24px)" }}
    >
      {/* ── Search Bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/5">
        <Search size={18} className="text-blue-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search people, circles, posts…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-white text-[15px] font-semibold outline-none placeholder:text-white/25"
        />
        {loading && <Loader2 size={16} className="text-blue-400 animate-spin shrink-0" />}
        <button onClick={onClose}
          className="p-1.5 hover:bg-white/10 rounded-xl text-white/50 hover:text-white transition-all shrink-0">
          <X size={20} />
        </button>
      </div>

      {/* ── Results / Suggestions ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-10">

        {/* No results state */}
        {noResults && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-white/20">
            <Search size={40} strokeWidth={1.5} />
            <p className="text-[11px] font-black uppercase tracking-widest">No results for "{query}"</p>
          </div>
        )}

        {/* ── SEARCH RESULTS ─────────────────────────────────────────── */}
        {isSearching && !noResults && (
          <>
            {/* People results */}
            {people.length > 0 && (
              <div className="pt-5">
                <div className="flex items-center gap-2 px-4 mb-3">
                  <Users size={12} className="text-blue-400" />
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">People</p>
                </div>
                {people.map(person => (
                  <div key={person.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors">
                    <div className="w-11 h-11 rounded-full bg-blue-600 overflow-hidden border border-white/10 shrink-0">
                      {person.avatar_url
                        ? <img src={person.avatar_url} className="w-full h-full object-cover" alt="" />
                        : <div className="w-full h-full flex items-center justify-center text-white font-black text-sm">{person.full_name?.[0]}</div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-[13px] truncate">{person.full_name}</p>
                      {(person.fame_points || 0) > 0 && (
                        <p className="text-yellow-400/60 text-[10px]">⭐ {person.fame_points} fame</p>
                      )}
                    </div>
                    <button
                      onClick={(e) => handleAddFriend(e, person.id)}
                      disabled={sentRequests.has(person.id)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-extrabold active:scale-95 transition-all shrink-0 ${
                        sentRequests.has(person.id)
                          ? "bg-white/10 text-white/40"
                          : "text-white shadow-lg"
                      }`}
                      style={sentRequests.has(person.id) ? {} : { background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)", boxShadow: "0 4px 14px rgba(79,70,229,0.5)" }}
                    >
                      {sentRequests.has(person.id) ? "Requested" : "+ Add Friend"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Circle results */}
            {circles.length > 0 && (
              <div className="pt-5">
                <div className="flex items-center gap-2 px-4 mb-3">
                  <Users size={12} className="text-purple-400" />
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Circles</p>
                </div>
                {circles.map(circle => (
                  <div key={circle.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors">
                    <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-white/10"
                      style={{ background: circleGrad(circle.id) }}>
                      {circle.cover_url && <img src={circle.cover_url} className="w-full h-full object-cover" alt="" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-[13px] truncate">{circle.name}</p>
                      <p className="text-white/40 text-[10px]">{circle.member_count ?? 0} members · {circle.privacy || "public"}</p>
                    </div>
                    <button className="px-3 py-1.5 bg-purple-600 rounded-xl text-[10px] font-black text-white active:scale-95 transition-transform shrink-0">
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Post results */}
            {posts.length > 0 && (
              <div className="pt-5">
                <div className="flex items-center gap-2 px-4 mb-3">
                  <FileText size={12} className="text-green-400" />
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Posts</p>
                </div>
                {posts.map(post => (
                  <div key={post.id} className="px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors">
                    <p className="text-white/40 text-[10px] mb-1 font-semibold">@{post.author}</p>
                    <p className="text-white/80 text-[13px] leading-snug line-clamp-2">{post.content}</p>
                    {post.media_url && (
                      <div className="mt-2 w-16 h-12 rounded-lg overflow-hidden bg-white/5">
                        <img src={post.media_url} className="w-full h-full object-cover" loading="lazy" alt="" />
                      </div>
                    )}
                    <div className="flex items-center gap-1 mt-1.5">
                      <Heart size={10} className="text-red-400" />
                      <span className="text-white/30 text-[10px] font-semibold">{post.likes_count || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── SUGGESTIONS (shown when query is empty) ────────────────── */}
        {!isSearching && (
          <>
            {/* Suggested People */}
            {sugPeople.length > 0 && (
              <div className="pt-5">
                <div className="flex items-center gap-2 px-4 mb-3">
                  <span className="text-[12px]">🔥</span>
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Suggested People</p>
                </div>
                {sugPeople.map(person => (
                  <div key={person.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors">
                    <div className="w-11 h-11 rounded-full bg-blue-600 overflow-hidden border border-white/10 shrink-0">
                      {person.avatar_url
                        ? <img src={person.avatar_url} className="w-full h-full object-cover" alt="" />
                        : <div className="w-full h-full flex items-center justify-center text-white font-black text-sm">{person.full_name?.[0]}</div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-[13px] truncate">{person.full_name}</p>
                      {(person.fame_points || 0) > 0 && (
                        <p className="text-yellow-400/60 text-[10px]">⭐ {person.fame_points} fame</p>
                      )}
                    </div>
                    <button
                      onClick={(e) => handleAddFriend(e, person.id)}
                      disabled={sentRequests.has(person.id)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-extrabold active:scale-95 transition-all shrink-0 ${
                        sentRequests.has(person.id)
                          ? "bg-white/10 text-white/40"
                          : "text-white shadow-lg"
                      }`}
                      style={sentRequests.has(person.id) ? {} : { background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)", boxShadow: "0 4px 14px rgba(79,70,229,0.5)" }}
                    >
                      {sentRequests.has(person.id) ? "Requested" : "+ Add Friend"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Popular Circles */}
            {sugCircles.length > 0 && (
              <div className="pt-5">
                <div className="flex items-center gap-2 px-4 mb-3">
                  <span className="text-[12px]">👥</span>
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Popular Circles</p>
                </div>
                {sugCircles.map(circle => (
                  <div key={circle.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors">
                    <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-white/10"
                      style={{ background: circleGrad(circle.id) }}>
                      {circle.cover_url && <img src={circle.cover_url} className="w-full h-full object-cover" alt="" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-[13px] truncate">{circle.name}</p>
                      <p className="text-white/40 text-[10px]">{circle.member_count ?? 0} members</p>
                    </div>
                    <button className="px-3 py-1.5 bg-white/10 border border-white/15 rounded-xl text-[10px] font-black text-white/70 active:scale-95 transition-transform shrink-0">
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Empty suggestions state */}
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
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotif, setShowNotif]         = useState(false);
  const [showSearch, setShowSearch]       = useState(false);
  const [pendingFriendCount, setPendingFriendCount] = useState(0);
  const [userData, setUserData] = useState({
    full_name: "...",
    avatar_url: "",
    id: userId || "",
  });

  useEffect(() => {
    if (!userId) return;
    fetchProfile();
    fetchNotifications();
    fetchPendingFriendCount();

    const notifChannel = supabase
      .channel(`notif-changes-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => setNotifications((prev) => [payload.new, ...prev])
      )
      .subscribe();

    const friendChannel = supabase
      .channel(`friend-req-badge-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "friendships", filter: `receiver_id=eq.${userId}` },
        (payload) => { if (payload.new.status === "pending") setPendingFriendCount((p) => p + 1); }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "friendships", filter: `receiver_id=eq.${userId}` },
        (payload) => {
          if (payload.new.status === "accepted" || payload.new.status === "rejected")
            setPendingFriendCount((p) => Math.max(0, p - 1));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(friendChannel);
    };
  }, [userId]);

  const fetchProfile = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("profiles").select("full_name, avatar_url").eq("id", userId).single();
    if (data) setUserData((prev) => ({ ...prev, ...data }));
  };

  const fetchNotifications = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (data) setNotifications(data);
  };

  const fetchPendingFriendCount = async () => {
    if (!userId) return;
    const { count } = await supabase
      .from("friendships")
      .select("id", { count: "exact", head: true })
      .eq("receiver_id", userId).eq("status", "pending");
    setPendingFriendCount(count || 0);
  };

  const unreadNotifCount = notifications.filter((n) => !n.is_read).length;
  const totalBadge = unreadNotifCount + pendingFriendCount;

  return (
    <>
      {/* ── GLASS HEADER ─────────────────────────────────────────────────── */}
      <header className="w-full h-14 bg-white/10 backdrop-blur-2xl border-b border-white/10 sticky top-0 z-[100] px-3 sm:px-5 flex items-center gap-3 transition-all relative overflow-hidden">

        {/* 1. LEFT: Logo + Tagline + Tiranga ─────────────────────────────── */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Animated "F" orb */}
          <motion.div
            animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
            className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0"
          >
            <span className="text-white font-black text-[12px] italic">F</span>
          </motion.div>

          {/* Scramble logo + tagline */}
          <FacelookLogo />

          {/* Tiranga waving */}
          <TirangaFlag />
        </div>

        {/* 2. SPACER ───────────────────────────────────────────────────────── */}
        <div className="flex-1" />

        {/* 3. RIGHT: Compact Search + Bell + Avatar ────────────────────────── */}
        <div className="flex items-center gap-2 flex-shrink-0">

          {/* Friend request mini-badge */}
          {pendingFriendCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="hidden sm:flex items-center gap-1 px-2 py-1 bg-blue-600/20 border border-blue-500/30 rounded-full"
            >
              <UserPlus size={10} className="text-blue-400" />
              <span className="text-[9px] font-black text-blue-300">{pendingFriendCount}</span>
            </motion.div>
          )}

          {/* Home back button */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={onHomeClick}
            className="p-2 bg-white/10 border border-white/15 text-white rounded-xl hover:bg-white/15 transition-all active:scale-90 flex-shrink-0"
            title="Back to Home"
          >
            <Home size={17} />
          </motion.button>

          {/* Search button */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => setShowSearch(true)}
            className="p-2 bg-white/10 border border-white/15 text-white rounded-xl hover:bg-blue-500/20 hover:border-blue-500/40 transition-all active:scale-90 flex-shrink-0"
            title="Search"
          >
            <Search size={17} />
          </motion.button>

          {/* Bell */}
          <button
            onClick={() => setShowNotif(!showNotif)}
            className="p-2.5 bg-white/5 border border-white/10 text-white rounded-2xl relative hover:bg-white/10 transition-all active:scale-90 flex-shrink-0"
          >
            <Bell size={18} className="drop-shadow-md" />
            {totalBadge > 0 && (
              <motion.span
                key={totalBadge}
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-slate-900 px-0.5"
              >
                {totalBadge > 99 ? "99+" : totalBadge}
              </motion.span>
            )}
          </button>

          {/* Settings gear */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={onSettingsClick}
            className="p-2 bg-white/10 border border-white/15 text-white rounded-xl hover:bg-white/15 transition-all active:scale-90 flex-shrink-0"
            title="Settings"
          >
            <Settings size={17} />
          </motion.button>

          {/* Avatar — profile */}
          <div
            onClick={onProfileClick}
            className="w-9 h-9 rounded-xl overflow-hidden border border-white/30 shadow-lg cursor-pointer active:scale-90 transition-transform flex-shrink-0"
          >
            {userData.avatar_url ? (
              <img src={userData.avatar_url} loading="lazy" className="w-full h-full object-cover" alt="Profile" />
            ) : (
              <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white font-black text-xs">
                {userData.full_name[0]}
              </div>
            )}
          </div>
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
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowNotif(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[105]"
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-xs bg-slate-900/80 backdrop-blur-3xl shadow-2xl z-[110] border-l border-white/10 overflow-hidden"
            >
              <div className="p-6 flex items-center justify-between border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-2">
                  <h2 className="font-black text-white tracking-widest text-xs uppercase">Notifications</h2>
                  {pendingFriendCount > 0 && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-600/20 border border-blue-500/30 rounded-full text-[9px] font-black text-blue-300">
                      <UserPlus size={9} /> {pendingFriendCount} friend{pendingFriendCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <button onClick={() => setShowNotif(false)} className="p-2 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 space-y-3 overflow-y-auto h-[calc(100%-80px)]">
                {pendingFriendCount > 0 && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl"
                  >
                    <div className="flex gap-3 items-start">
                      <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400 shrink-0"><UserPlus size={14} /></div>
                      <div>
                        <p className="text-xs font-black text-white leading-tight">
                          {pendingFriendCount} pending friend request{pendingFriendCount > 1 ? "s" : ""}
                        </p>
                        <p className="text-[10px] text-white/40 mt-0.5">Open Messages → Requests to respond</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {notifications.length > 0 ? (
                  notifications.map((n) => (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      key={n.id}
                      className="text-[11px] p-4 bg-white/5 border border-white/10 rounded-2xl font-bold text-white/80 hover:bg-white/10 transition-all cursor-default"
                    >
                      <div className="flex gap-3 items-start">
                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400 shrink-0"><Bell size={14} /></div>
                        <p className="leading-relaxed">{n.content}</p>
                      </div>
                    </motion.div>
                  ))
                ) : pendingFriendCount === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/20">
                    <Bell size={40} strokeWidth={1} className="mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-tighter">No new updates</p>
                  </div>
                ) : null}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;
