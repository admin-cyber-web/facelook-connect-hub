/**
 * NewInYourArea — "✨ New in Your Area" discovery strip + cinematic popup
 *
 * Shows recently-joined PUBLIC users from the same district/city/state.
 * On first meaningful discovery → shows a one-time glassmorphic popup.
 */

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, X, UserPlus, Sparkles } from "lucide-react";
import { fetchNewInYourArea, type LocalProfile, type RecommendedUser } from "@/lib/recommendationEngine";
import { supabase } from "@/lib/supabaseClient";

const POPUP_KEY = "flicks_new_in_area_popup_v1";

interface Props {
  currentUserId: string;
  localProfile:  LocalProfile;
  onProfileClick?: (userId: string) => void;
}

export default function NewInYourArea({ currentUserId, localProfile, onProfileClick }: Props) {
  const [users,        setUsers]        = useState<RecommendedUser[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showPopup,    setShowPopup]    = useState(false);
  const [popupUser,    setPopupUser]    = useState<RecommendedUser | null>(null);
  const [sentIds,      setSentIds]      = useState<Set<string>>(new Set());
  const didFetch                        = useRef(false);

  const doFetch = async () => {
    try {
      const results = await fetchNewInYourArea(currentUserId, localProfile, 8);
      setUsers(results);

      // Show popup once per user lifetime (not just session) if we find people nearby
      const dismissed = localStorage.getItem(POPUP_KEY);
      if (!dismissed && results.length > 0) {
        setPopupUser(results[0]);
        setTimeout(() => setShowPopup(true), 1200);
      }
    } catch (e) {
      console.warn("[NewInYourArea]", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (didFetch.current) return;
    if (!currentUserId || (!localProfile.state && !localProfile.district && !localProfile.city)) {
      setLoading(false);
      return;
    }
    didFetch.current = true;
    doFetch();
  }, [currentUserId, localProfile.district, localProfile.city, localProfile.state]);

  // ── Realtime: re-fetch when a new user joins the same area ───────────────
  useEffect(() => {
    const areaKey = localProfile.district || localProfile.city || localProfile.state;
    if (!areaKey || !currentUserId) return;

    const channelName = `new-user-${areaKey.toLowerCase().replace(/\s+/g, "-")}`;
    const channel = (supabase as any)
      .channel(channelName)
      .on("broadcast", { event: "new_user_joined" }, () => {
        // Re-fetch silently; update strip without showing popup again
        fetchNewInYourArea(currentUserId, localProfile, 8)
          .then(results => { if (results.length > 0) setUsers(results); })
          .catch(() => {});
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, localProfile.district, localProfile.city, localProfile.state]);

  const dismissPopup = () => {
    setShowPopup(false);
    localStorage.setItem(POPUP_KEY, "1");
  };

  const handleConnect = async (userId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (sentIds.has(userId)) return;
    const { error } = await supabase.from("friend_requests").insert({
      sender_id:   currentUserId,
      receiver_id: userId,
      status:      "pending",
    });
    if (!error || error.message?.includes("duplicate") || error.message?.includes("unique")) {
      setSentIds(prev => new Set(prev).add(userId));
    }
    dismissPopup();
  };

  // Don't render if no location or no users
  if (loading || users.length === 0) return null;

  const locationLabel =
    localProfile.city || localProfile.district || localProfile.state || "Your Area";

  return (
    <>
      {/* ── Discovery Popup ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showPopup && popupUser && (
          <motion.div
            key="discovery-popup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-end justify-center pb-8 px-4"
            style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
            onClick={dismissPopup}
          >
            <motion.div
              initial={{ y: 80, scale: 0.92, opacity: 0 }}
              animate={{ y: 0,  scale: 1,    opacity: 1 }}
              exit={{    y: 60, scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="w-full max-w-sm rounded-[28px] overflow-hidden relative"
              style={{
                background: "linear-gradient(135deg, rgba(20,14,40,0.97) 0%, rgba(10,8,28,0.99) 100%)",
                border:     "1px solid rgba(139,92,246,0.35)",
                boxShadow:  "0 0 40px rgba(139,92,246,0.2), 0 20px 60px rgba(0,0,0,0.7)",
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Glow stripe */}
              <div className="absolute inset-x-0 top-0 h-[2px]"
                style={{ background: "linear-gradient(90deg,transparent,#7c3aed,#06b6d4,transparent)" }} />

              <div className="p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">✨</span>
                    <span className="text-[13px] font-black text-white/80 tracking-tight">
                      New in {locationLabel}
                    </span>
                  </div>
                  <button
                    onClick={dismissPopup}
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.07)" }}
                  >
                    <X size={13} className="text-white/50" />
                  </button>
                </div>

                {/* User card */}
                <div className="flex items-center gap-3.5 mb-5">
                  <div
                    className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center font-black text-2xl text-white"
                    style={{ background: "linear-gradient(135deg,#7c3aed,#2563eb)" }}
                  >
                    {popupUser.avatar_url ? (
                      <img src={popupUser.avatar_url} className="w-full h-full object-cover" alt="" />
                    ) : (
                      (popupUser.full_name || "U")[0].toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-black text-white truncate">
                      {popupUser.full_name || "Someone new"}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin size={10} className="text-violet-400 shrink-0" />
                      <span className="text-[11px] text-violet-300 font-semibold truncate">{popupUser.reason}</span>
                    </div>
                    {popupUser.interests.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {popupUser.interests.slice(0, 3).map(tag => (
                          <span
                            key={tag}
                            className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                            style={{ background: "rgba(139,92,246,0.18)", color: "#c4b5fd" }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* CTAs */}
                <div className="flex gap-2.5">
                  <button
                    onClick={() => handleConnect(popupUser.id)}
                    disabled={sentIds.has(popupUser.id)}
                    className="flex-1 py-3 rounded-2xl font-black text-[13px] text-white flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    style={{
                      background: sentIds.has(popupUser.id)
                        ? "rgba(255,255,255,0.08)"
                        : "linear-gradient(135deg,#7c3aed 0%,#2563eb 100%)",
                    }}
                  >
                    <UserPlus size={13} />
                    {sentIds.has(popupUser.id) ? "Sent!" : "Connect"}
                  </button>
                  <button
                    onClick={dismissPopup}
                    className="flex-1 py-3 rounded-2xl font-black text-[12px] text-white/40 transition-all active:scale-95"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    Not Now
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Discovery Strip ──────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden mb-3 mx-0"
        style={{
          background: "linear-gradient(135deg,rgba(17,10,38,0.98) 0%,rgba(9,8,22,0.99) 100%)",
          border:     "1px solid rgba(139,92,246,0.15)",
        }}
      >
        {/* Strip header */}
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#7c3aed,#06b6d4)" }}
            >
              <Sparkles size={11} className="text-white" />
            </div>
            <span className="text-[12px] font-black text-white/80 tracking-tight">
              New in {locationLabel}
            </span>
            <span
              className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa" }}
            >
              {users.length} NEW
            </span>
          </div>
        </div>

        {/* Cards row */}
        <div className="flex gap-2.5 overflow-x-auto px-4 pb-3.5 no-scrollbar">
          {users.map((u, i) => {
            const isSent = sentIds.has(u.id);
            const first  = (u.full_name || "User").split(" ")[0];
            return (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05, type: "spring", stiffness: 260, damping: 22 }}
                className="flex-shrink-0 relative rounded-2xl overflow-hidden cursor-pointer active:scale-95 transition-transform"
                style={{
                  width: 104,
                  height: 160,
                  background: "linear-gradient(160deg,rgba(124,58,237,0.25) 0%,rgba(6,182,212,0.1) 100%)",
                  border: "1px solid rgba(139,92,246,0.2)",
                }}
                onClick={() => onProfileClick?.(u.id)}
              >
                {/* Avatar */}
                {u.avatar_url ? (
                  <img
                    src={u.avatar_url}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover absolute inset-0"
                    alt={u.full_name || ""}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl font-black text-white/40 select-none">
                    {(u.full_name || "U")[0].toUpperCase()}
                  </div>
                )}

                {/* Gradient overlay */}
                <div className="absolute inset-0"
                  style={{ background: "linear-gradient(to top,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.2) 55%,transparent 100%)" }} />

                {/* NEW badge */}
                <div
                  className="absolute top-2 left-2 text-[8px] font-black px-1.5 py-0.5 rounded-full"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#2563eb)", color: "#fff" }}
                >
                  NEW
                </div>

                {/* Bottom info */}
                <div className="absolute bottom-0 inset-x-0 px-2 pb-2 flex flex-col items-center gap-1.5">
                  <p className="text-white text-[12px] font-black truncate w-full text-center leading-tight">
                    {first}
                  </p>
                  <div className="flex items-center gap-0.5 w-full justify-center">
                    <MapPin size={8} className="text-violet-300 shrink-0" />
                    <span className="text-[9px] text-violet-300 font-semibold truncate">{u.reason}</span>
                  </div>
                  <button
                    onClick={e => handleConnect(u.id, e)}
                    disabled={isSent}
                    className="w-full py-1.5 rounded-xl text-[10px] font-black text-white transition-all active:scale-95"
                    style={{
                      background: isSent
                        ? "rgba(255,255,255,0.08)"
                        : "linear-gradient(135deg,rgba(124,58,237,0.8),rgba(37,99,235,0.8))",
                    }}
                  >
                    {isSent ? "Sent ✓" : "Connect"}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </>
  );
}
