/**
 * PeopleYouMayKnow — Smart recommendation strip
 *
 * Uses the recommendation engine (geo + interest + freshness scoring) to rank
 * nearby / similar users. Shows up to 8 cards with a reason label.
 * Fully respects privacy: private-mode and hidden profiles are excluded.
 */

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Users, UserPlus, RefreshCw } from "lucide-react";
import { fetchRecommendedPeople, type LocalProfile, type RecommendedUser } from "@/lib/recommendationEngine";
import { supabase } from "@/lib/supabaseClient";
import { memGet, memSet } from "@/lib/memCache";

interface Props {
  currentUserId: string;
  localProfile?: LocalProfile;
  onProfileClick?: (userId: string) => void;
}

const GRAD = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ef4444","#06b6d4"];

export default function PeopleYouMayKnow({ currentUserId, localProfile = {}, onProfileClick }: Props) {
  const [users,   setUsers]   = useState<RecommendedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const didFetch              = useRef(false);

  const load = async (force = false) => {
    setLoading(true);
    const cacheKey = `smartPeople_${currentUserId}`;
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
    </div>
  );
}
