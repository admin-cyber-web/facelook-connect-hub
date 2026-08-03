/**
 * PeopleYouMayKnow — Smart recommendation strip
 *
 * Uses the recommendation engine (geo + interest + freshness + mutual scoring) to rank
 * nearby / similar users. Shows up to 8 cards with a reason label.
 * Tap the ℹ️ button on any card to see why they're being suggested.
 * Fully respects privacy: private-mode and hidden profiles are excluded.
 */

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Users, UserPlus, RefreshCw, X, Info } from "lucide-react";
import { fetchRecommendedPeople, type LocalProfile, type RecommendedUser } from "@/lib/recommendationEngine";
import { supabase } from "@/lib/supabaseClient";
import { memGet, memSet, memDel } from "@/lib/memCache";

interface Props {
  currentUserId: string;
  localProfile?: LocalProfile;
  onProfileClick?: (userId: string) => void;
}

const GRAD = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ef4444","#06b6d4"];

export default function PeopleYouMayKnow({ currentUserId, localProfile = {}, onProfileClick }: Props) {
  const [users,        setUsers]        = useState<RecommendedUser[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [sentIds,      setSentIds]      = useState<Set<string>>(new Set());
  const [infoCardId,   setInfoCardId]   = useState<string | null>(null);
  const didFetch                        = useRef(false);
  const cacheKey                        = `smartPeople_${currentUserId}`;

  const load = async (force = false) => {
    setLoading(true);
    if (!force) {
      const cached = memGet<RecommendedUser[]>(cacheKey);
      if (cached) { setUsers(cached); setLoading(false); return; }
    }
    try {
      const results = await fetchRecommendedPeople(currentUserId, localProfile, 9);
      setUsers(results);
      memSet(cacheKey, results, 5 * 60_000); // 5 min cache
    } catch (e) {
      console.warn("[PeopleYouMayKnow]", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUserId || didFetch.current) return;
    didFetch.current = true;
    load();
  }, [currentUserId]);

  // Listen for preference / privacy changes → bust cache and re-fetch
  useEffect(() => {
    const bust = () => {
      memDel(cacheKey);
      didFetch.current = false;
      load(true);
    };
    window.addEventListener("flicks:rec-prefs-changed", bust);
    return () => window.removeEventListener("flicks:rec-prefs-changed", bust);
  }, [currentUserId]);

  const handleConnect = async (targetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sentIds.has(targetId)) return;
    const { error } = await supabase.from("friend_requests").insert({
      sender_id:   currentUserId,
      receiver_id: targetId,
      status:      "pending",
    });
    if (!error || error.message?.includes("duplicate") || error.message?.includes("unique")) {
      setSentIds(prev => new Set(prev).add(targetId));
    }
  };

  if (loading) return (
    <div className="flex gap-3 overflow-x-auto px-4 py-3 no-scrollbar">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex-shrink-0 rounded-2xl animate-pulse"
          style={{ width: 120, height: 212, background: "rgba(255,255,255,0.04)" }} />
      ))}
    </div>
  );

  if (users.length === 0) return null;

  const infoUser = infoCardId ? users.find(u => u.id === infoCardId) : null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-4 mb-2">
        <div className="flex items-center gap-2">
          <Users size={13} className="text-white/40" />
          <span className="text-[13px] font-black text-white/70 tracking-tight">People You May Know</span>
        </div>
        <button
          onClick={() => load(true)}
          className="flex items-center gap-1 text-[10px] font-black text-white/30 hover:text-white/60 transition-colors"
        >
          <RefreshCw size={10} />
          Refresh
        </button>
      </div>

      {/* Cards */}
      <div className="flex gap-3 overflow-x-auto px-4 pb-2 no-scrollbar scroll-smooth">
        {users.map((u, i) => {
          const isSent  = sentIds.has(u.id);
          const first   = (u.full_name || "User").split(" ")[0];
          const hasLoc  = !!(u.city || u.district || u.state);
          return (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04, type: "spring", stiffness: 240, damping: 20 }}
              className="flex-shrink-0 relative rounded-2xl overflow-hidden cursor-pointer active:scale-[0.97] transition-transform"
              style={{
                width: 120, height: 212,
                background: `linear-gradient(160deg,${GRAD[i % GRAD.length]}33 0%,#1e1b4b 100%)`,
                border: "1px solid rgba(255,255,255,0.07)",
              }}
              onClick={() => onProfileClick?.(u.id)}
            >
              {/* Avatar */}
              {u.avatar_url ? (
                <img src={u.avatar_url} loading="lazy" decoding="async"
                  className="w-full h-full object-cover absolute inset-0" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-black text-5xl text-white/30 select-none">
                  {(u.full_name || "U")[0].toUpperCase()}
                </div>
              )}

              {/* Gradient overlay */}
              <div className="absolute inset-0"
                style={{ background: "linear-gradient(to top,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.15) 55%,transparent 100%)" }} />

              {/* NEW badge */}
              <AnimatePresence>
                {u.isNew && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute top-2 left-2 text-[8px] font-black px-1.5 py-0.5 rounded-full"
                    style={{ background: "linear-gradient(135deg,#7c3aed,#2563eb)", color: "#fff" }}
                  >
                    NEW
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ℹ️ Info button — "Why am I seeing this?" */}
              <button
                onClick={e => { e.stopPropagation(); setInfoCardId(u.id); }}
                className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center transition-opacity opacity-60 hover:opacity-100 active:scale-90"
                style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
              >
                <Info size={9} className="text-white" />
              </button>

              {/* Bottom */}
              <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-3 flex flex-col items-center gap-1.5">
                <p className="text-white text-[14px] font-black truncate w-full text-center leading-tight drop-shadow-sm">
                  {first}
                </p>

                {/* Reason tag */}
                <div className="flex items-center gap-0.5 w-full justify-center">
                  {hasLoc && <MapPin size={8} className="text-violet-300 shrink-0" />}
                  <span className="text-[9px] text-white/50 font-semibold truncate leading-tight">
                    {u.reason}
                  </span>
                </div>

                {u.fame_points != null && u.fame_points > 0 && (
                  <p className="text-white/50 text-[10px] font-black leading-none">
                    ⭐ {u.fame_points}
                  </p>
                )}

                {/* Connect button */}
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={e => handleConnect(u.id, e)}
                  disabled={isSent}
                  className="w-full py-2 rounded-xl font-black text-[11px] leading-tight flex items-center justify-center gap-1 transition-all"
                  style={{
                    background: isSent
                      ? "rgba(255,255,255,0.08)"
                      : `linear-gradient(135deg,${GRAD[i % GRAD.length]}cc,${GRAD[(i + 2) % GRAD.length]}99)`,
                    color: isSent ? "rgba(255,255,255,0.4)" : "#fff",
                  }}
                >
                  {isSent ? (
                    <span>Sent ✓</span>
                  ) : (
                    <>
                      <UserPlus size={9} />
                      <span>Add Friend</span>
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* "Why am I seeing this?" sheet */}
      <AnimatePresence>
        {infoUser && (
          <motion.div
            key="why-sheet"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] flex items-end justify-center pb-8 px-4"
            style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
            onClick={() => setInfoCardId(null)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0,  opacity: 1 }}
              exit={{    y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 340, damping: 28 }}
              className="w-full max-w-sm rounded-[24px] p-5"
              style={{
                background: "linear-gradient(135deg,rgba(20,12,36,0.98) 0%,rgba(10,8,24,0.99) 100%)",
                border: "1px solid rgba(139,92,246,0.25)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">🤔</span>
                  <span className="text-[14px] font-black text-white/90">Why am I seeing this?</span>
                </div>
                <button
                  onClick={() => setInfoCardId(null)}
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.07)" }}
                >
                  <X size={13} className="text-white/50" />
                </button>
              </div>

              {/* User mini card */}
              <div className="flex items-center gap-3 mb-4 p-3 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div
                  className="w-10 h-10 rounded-xl overflow-hidden shrink-0 flex items-center justify-center font-black text-lg text-white"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#2563eb)" }}
                >
                  {infoUser.avatar_url
                    ? <img src={infoUser.avatar_url} className="w-full h-full object-cover" alt="" />
                    : (infoUser.full_name || "U")[0].toUpperCase()
                  }
                </div>
                <div>
                  <p className="text-[13px] font-black text-white">{infoUser.full_name || "Someone"}</p>
                  {infoUser.username && <p className="text-[10px] text-white/40">@{infoUser.username}</p>}
                </div>
              </div>

              {/* Reason details */}
              <div className="space-y-2 mb-4">
                {(infoUser.reasonDetail || infoUser.reason).split(" · ").map((part, idx) => (
                  <div key={idx} className="flex items-center gap-2.5">
                    <div
                      className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[9px]"
                      style={{ background: "rgba(139,92,246,0.2)" }}
                    >
                      {idx === 0 ? "📍" : idx === 1 ? "👥" : "🎯"}
                    </div>
                    <span className="text-[12px] text-white/70 font-semibold">{part}</span>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-white/25 font-medium text-center leading-relaxed">
                Suggestions are based on location, shared interests, and mutual friends.
                Your data is never shared publicly.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
