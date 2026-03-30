import { useState, useEffect } from "react";
import {
  Bell,
  X,
  Heart,
  UserPlus,
  MessageCircle,
  ShieldAlert,
  Check,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";

const Header = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const userId = "ec047c60-4960-4083-b798-1749c0ab85dc"; // आपकी फिक्स्ड ID

  useEffect(() => {
    fetchNotifications();

    // ⚡ Real-time Subscription: जैसे ही नया नोटिफिकेशन आए, तुरंत दिखाओ
    const channel = supabase
      .channel("schema-db-changes")
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
          // ब्राउज़र साउंड या अलर्ट यहाँ जोड़ सकते हैं
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*, actor:profiles(full_name, avatar_url)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (data) setNotifications(data);
  };

  const markAsRead = async () => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId);
    setShowNotif(!showNotif);
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <>
      <header className="fixed top-0 left-0 w-full h-20 bg-white/80 backdrop-blur-xl border-b border-slate-100 z-[100] px-6 flex items-center justify-between">
        <h1 className="text-2xl font-black text-blue-600 tracking-tighter">
          FaceLook
        </h1>

        <div className="relative">
          <button
            onClick={markAsRead}
            className="p-3 bg-slate-50 rounded-2xl relative hover:bg-blue-50 transition-colors group"
          >
            <Bell
              size={22}
              className="text-slate-600 group-hover:text-blue-600"
            />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Notifications Drawer */}
      <AnimatePresence>
        {showNotif && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            className="fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-[110] border-l border-slate-100 overflow-hidden"
          >
            <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-black text-slate-800">
                Notifications
              </h2>
              <button
                onClick={() => setShowNotif(false)}
                className="p-2 hover:bg-white rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto h-[calc(100%-80px)] p-4 space-y-3">
              {notifications.length === 0 ? (
                <div className="text-center py-20 text-slate-300 font-bold italic text-sm">
                  No alerts yet...
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-4 rounded-[1.5rem] flex items-start gap-4 transition-all ${n.is_read ? "bg-white border border-slate-50" : "bg-blue-50/50 border border-blue-100 shadow-sm"}`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0">
                      {n.type === "like" && (
                        <Heart
                          size={18}
                          className="text-red-500 fill-red-500"
                        />
                      )}
                      {n.type === "friend_request" && (
                        <UserPlus size={18} className="text-blue-600" />
                      )}
                      {n.type === "comment" && (
                        <MessageCircle size={18} className="text-green-500" />
                      )}
                      {n.type === "system" && (
                        <ShieldAlert size={18} className="text-orange-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-800 leading-tight">
                        {n.content}
                      </p>
                      <p className="text-[9px] text-slate-400 font-black mt-1 uppercase tracking-tighter">
                        {new Date(n.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {!n.is_read && (
                      <div className="w-2 h-2 bg-blue-600 rounded-full mt-2" />
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;
