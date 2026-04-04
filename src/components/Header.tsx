import { useState, useEffect } from "react";
import { Bell, Search, X, UserPlus } from "lucide-react";
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

// ── Main Header ────────────────────────────────────────────────────────────────
const Header = ({
  onProfileClick,
  userId,
}: {
  onProfileClick?: () => void;
  userId?: string;
}) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotif, setShowNotif]         = useState(false);
  const [searchQuery, setSearchQuery]     = useState("");
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

          {/* Compact search */}
          <div className="relative group flex items-center">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-blue-400 transition-colors pointer-events-none">
              <Search size={14} />
            </div>
            <input
              type="text"
              placeholder="Search..."
              className="h-9 w-28 sm:w-44 bg-white/5 border border-white/10 rounded-2xl pl-8 pr-3 text-[11px] font-bold text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white/10 focus:w-40 sm:focus:w-52 transition-all duration-300 shadow-inner"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

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

          {/* Avatar */}
          <div
            onClick={onProfileClick}
            className="w-9 h-9 rounded-xl overflow-hidden border border-white/30 shadow-lg cursor-pointer active:scale-90 transition-transform flex-shrink-0"
          >
            {userData.avatar_url ? (
              <img src={userData.avatar_url} className="w-full h-full object-cover" alt="Profile" />
            ) : (
              <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white font-black text-xs">
                {userData.full_name[0]}
              </div>
            )}
          </div>
        </div>
      </header>

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
