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

  // आपकी फिक्स्ड यूजर प्रोफाइल डिटेल्स (इसे आप प्रॉप्स से भी ले सकते हैं)
  const [userData, setUserData] = useState({
    full_name: "Loading...",
    avatar_url: "",
    id: "ec047c60-4960-4083-b798-1749c0ab85dc",
  });

  useEffect(() => {
    fetchProfile();
    fetchNotifications();

    // रियल-टाइम नोटिफिकेशन लिसनर
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
      <header className="fixed top-0 left-0 w-full h-20 bg-white/90 backdrop-blur-2xl border-b border-slate-100 z-[100] px-4 flex items-center justify-between gap-4">
        {/* 1. LEFT: USER PROFILE (DP + NAME) */}
        <div
          onClick={onProfileClick}
          className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 pr-4 rounded-2xl transition-all flex-shrink-0"
        >
          <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-blue-100 shadow-sm">
            {userData.avatar_url ? (
              <img
                src={userData.avatar_url}
                className="w-full h-full object-cover"
                alt="Profile"
              />
            ) : (
              <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
                {userData.full_name[0]}
              </div>
            )}
          </div>
          <span className="hidden sm:block text-sm font-black text-slate-800 tracking-tight">
            {userData.full_name.split(" ")[0]}
          </span>
        </div>

        {/* 2. CENTER: SEARCH BAR (WORKING UI) */}
        <div className="flex-1 max-w-md relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="Search friends, schools, village..."
            className="w-full h-11 bg-slate-100/80 border-none rounded-2xl pl-12 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* 3. RIGHT: NOTIFICATION BELL */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowNotif(!showNotif)}
            className="p-3 bg-slate-100/50 rounded-2xl relative hover:bg-blue-50 hover:text-blue-600 transition-all active:scale-90"
          >
            <Bell size={20} className="font-bold" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Notifications Drawer (Same as before) */}
      <AnimatePresence>
        {showNotif && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            className="fixed top-0 right-0 h-full w-full max-w-xs bg-white shadow-2xl z-[110] border-l border-slate-100"
          >
            {/* ... Drawer Content ... (जैसा पिछले कोड में था) */}
            <div className="p-6 flex items-center justify-between border-b">
              <h2 className="font-black">Updates</h2>
              <button onClick={() => setShowNotif(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="text-[11px] p-3 bg-slate-50 rounded-xl font-bold"
                >
                  {n.content}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;
