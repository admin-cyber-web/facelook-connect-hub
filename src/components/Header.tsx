import { useState, useEffect } from "react";
import {
  Bell,
  Search,
  X,
  UserPlus,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";

const Header = ({
  onProfileClick,
  userId,
}: {
  onProfileClick?: () => void;
  userId?: string;
}) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingFriendCount, setPendingFriendCount] = useState(0);

  const [userData, setUserData] = useState({
    full_name: "Loading...",
    avatar_url: "",
    id: userId || "",
  });

  useEffect(() => {
    if (!userId) return;
    fetchProfile();
    fetchNotifications();
    fetchPendingFriendCount();

    // Realtime: notifications table
    const notifChannel = supabase
      .channel(`notif-changes-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    // Realtime: friendships table — new pending request where I am receiver
    const friendChannel = supabase
      .channel(`friend-req-badge-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "friendships",
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new.status === "pending") {
            setPendingFriendCount((prev) => prev + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "friendships",
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => {
          // Request was accepted or rejected — reduce count
          if (
            payload.new.status === "accepted" ||
            payload.new.status === "rejected"
          ) {
            setPendingFriendCount((prev) => Math.max(0, prev - 1));
          }
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
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", userId)
      .single();
    if (data) setUserData((prev) => ({ ...prev, ...data }));
  };

  const fetchNotifications = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (data) setNotifications(data);
  };

  const fetchPendingFriendCount = async () => {
    if (!userId) return;
    const { count } = await supabase
      .from("friendships")
      .select("id", { count: "exact", head: true })
      .eq("receiver_id", userId)
      .eq("status", "pending");
    setPendingFriendCount(count || 0);
  };

  const unreadNotifCount = notifications.filter((n) => !n.is_read).length;
  // Combined badge: unread notifications + pending friend requests
  const totalBadge = unreadNotifCount + pendingFriendCount;

  return (
    <>
      {/* ── GLASS HEADER ─────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 w-full h-20 bg-white/10 backdrop-blur-2xl border-b border-white/10 z-[100] px-3 sm:px-6 flex items-center justify-between gap-3 transition-all">
        {/* 1. LEFT: PROFILE */}
        <div
          onClick={onProfileClick}
          className="flex items-center gap-3 cursor-pointer hover:bg-white/10 p-1.5 rounded-2xl transition-all flex-shrink-0 group"
        >
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/30 shadow-lg group-active:scale-90 transition-transform">
            {userData.avatar_url ? (
              <img
                src={userData.avatar_url}
                className="w-full h-full object-cover"
                alt="Profile"
              />
            ) : (
              <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white font-black text-xs">
                {userData.full_name[0]}
              </div>
            )}
          </div>
          <span className="text-sm font-black text-white drop-shadow-md tracking-tight">
            {userData.full_name.split(" ")[0]}
          </span>
        </div>

        {/* 2. CENTER: SEARCH */}
        <div className="flex-1 max-w-md relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-blue-400 transition-colors">
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="Search vibes..."
            className="w-full h-11 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-xs font-bold text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white/10 transition-all shadow-inner"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* 3. RIGHT: NOTIFICATION BELL */}
        <div className="relative flex-shrink-0 flex items-center gap-2">
          {/* Friend request mini-badge (when there are pending requests) */}
          {pendingFriendCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 px-2.5 py-1 bg-blue-600/20 border border-blue-500/30 rounded-full"
            >
              <UserPlus size={11} className="text-blue-400" />
              <span className="text-[10px] font-black text-blue-300">
                {pendingFriendCount}
              </span>
            </motion.div>
          )}

          <button
            onClick={() => setShowNotif(!showNotif)}
            className="p-3 bg-white/5 border border-white/10 text-white rounded-2xl relative hover:bg-white/10 transition-all active:scale-90"
          >
            <Bell size={20} className="drop-shadow-md" />
            {totalBadge > 0 && (
              <motion.span
                key={totalBadge}
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-slate-900 px-1"
              >
                {totalBadge > 99 ? "99+" : totalBadge}
              </motion.span>
            )}
          </button>
        </div>
      </header>

      {/* ── NOTIFICATIONS DRAWER ─────────────────────────────────────── */}
      <AnimatePresence>
        {showNotif && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNotif(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[105]"
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-xs bg-slate-900/80 backdrop-blur-3xl shadow-2xl z-[110] border-l border-white/10 overflow-hidden"
            >
              <div className="p-6 flex items-center justify-between border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-2">
                  <h2 className="font-black text-white tracking-widest text-xs uppercase">
                    Notifications
                  </h2>
                  {pendingFriendCount > 0 && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-600/20 border border-blue-500/30 rounded-full text-[9px] font-black text-blue-300">
                      <UserPlus size={9} /> {pendingFriendCount} friend{pendingFriendCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowNotif(false)}
                  className="p-2 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 space-y-3 overflow-y-auto h-[calc(100%-80px)]">
                {/* Friend requests summary */}
                {pendingFriendCount > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl"
                  >
                    <div className="flex gap-3 items-start">
                      <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400 shrink-0">
                        <UserPlus size={14} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-white leading-tight">
                          {pendingFriendCount} pending friend request{pendingFriendCount > 1 ? "s" : ""}
                        </p>
                        <p className="text-[10px] text-white/40 mt-0.5">
                          Open Messages → Requests to respond
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {notifications.length > 0 ? (
                  notifications.map((n) => (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={n.id}
                      className="text-[11px] p-4 bg-white/5 border border-white/10 rounded-2xl font-bold text-white/80 hover:bg-white/10 transition-all cursor-default"
                    >
                      <div className="flex gap-3 items-start">
                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400 shrink-0">
                          <Bell size={14} />
                        </div>
                        <p className="leading-relaxed">{n.content}</p>
                      </div>
                    </motion.div>
                  ))
                ) : pendingFriendCount === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/20">
                    <Bell size={40} strokeWidth={1} className="mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-tighter">
                      No new updates
                    </p>
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
