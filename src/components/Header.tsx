import { useState, useEffect } from "react";
import {
  Bell,
  Search,
  X,
  Heart,
  UserPlus,
  MessageCircle,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";

const Header = ({ onProfileClick }: { onProfileClick?: () => void }) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [userData, setUserData] = useState({
    full_name: "Loading...",
    avatar_url: "",
    id: "ec047c60-4960-4083-b798-1749c0ab85dc",
  });

  useEffect(() => {
    fetchProfile();
    fetchNotifications();

    const channel = supabase
      .channel("notif-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userData.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", userData.id)
      .single();
    if (data) setUserData({ ...userData, ...data });
  };

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userData.id)
      .order("created_at", { ascending: false });
    if (data) setNotifications(data);
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <>
      {/* --- GLASS HEADER --- */}
      <header className="fixed top-0 left-0 w-full h-20 bg-white/10 backdrop-blur-2xl border-b border-white/10 z-[100] px-3 sm:px-6 flex items-center justify-between gap-3 transition-all">
        {/* 1. LEFT: PROFILE (NAME VISIBLE ON MOBILE NOW) */}
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
          {/* 'hidden' क्लास हटा दी गई है, अब मोबाइल पर भी नाम दिखेगा */}
          <span className="text-sm font-black text-white drop-shadow-md tracking-tight">
            {userData.full_name.split(" ")[0]}
          </span>
        </div>

        {/* 2. CENTER: GLASS SEARCH BAR */}
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

        {/* 3. RIGHT: NOTIFICATION (GLASS BUTTON) */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowNotif(!showNotif)}
            className="p-3 bg-white/5 border border-white/10 text-white rounded-2xl relative hover:bg-white/10 transition-all active:scale-90"
          >
            <Bell size={20} className="drop-shadow-md" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-slate-900 animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* --- NOTIFICATIONS DRAWER (GLASS STYLE) --- */}
      <AnimatePresence>
        {showNotif && (
          <>
            {/* Backdrop for closing drawer */}
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
                <h2 className="font-black text-white tracking-widest text-xs uppercase">
                  Notifications
                </h2>
                <button
                  onClick={() => setShowNotif(false)}
                  className="p-2 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 space-y-3 overflow-y-auto h-[calc(100%-80px)] custom-scrollbar">
                {notifications.length > 0 ? (
                  notifications.map((n) => (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={n.id}
                      className="text-[11px] p-4 bg-white/5 border border-white/10 rounded-2xl font-bold text-white/80 hover:bg-white/10 transition-all cursor-default"
                    >
                      <div className="flex gap-3 items-start">
                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                          <Bell size={14} />
                        </div>
                        <p className="leading-relaxed">{n.content}</p>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-white/20">
                    <Bell size={40} strokeWidth={1} className="mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-tighter">
                      No new updates
                    </p>
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
