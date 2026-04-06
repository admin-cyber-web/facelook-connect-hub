import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { X, MapPin, GraduationCap, UserPlus, MessageCircle, Check, Users, BookOpen, Link2 } from "lucide-react";
import { useProfileViewer } from "../context/ProfileViewerContext";
import { toast } from "sonner";

interface Props {
  userId: string;
  currentUserId: string;
  onClose: () => void;
}

interface ProfileData {
  id: string;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
  school?: string;
}

interface Friend {
  id: string;
  full_name: string;
  avatar_url?: string;
  friendshipId?: string;
}

const UserProfileModal = ({ userId, currentUserId, onClose }: Props) => {
  const { openProfile } = useProfileViewer();
  const [profile, setProfile]         = useState<ProfileData | null>(null);
  const [friends, setFriends]         = useState<Friend[]>([]);
  const [postCount, setPostCount]     = useState(0);
  const [friendCount, setFriendCount] = useState(0);
  const [hookCount, setHookCount]     = useState(0);
  const [pageCount, setPageCount]     = useState(0);
  const [friendStatus, setFriendStatus] = useState<"none" | "pending" | "accepted">("none");
  const [loading, setLoading]         = useState(true);
  const [kickingId, setKickingId]     = useState<string | null>(null);
  const dragY = useRef(0);

  const isOwnProfile = userId === currentUserId;

  useEffect(() => {
    if (!userId) return;
    setLoading(true);

    const run = async () => {
      const [profileRes, postsRes, friendsRes, statusRes, hooksRes, pagesRes] = await Promise.all([
        supabase.from("profiles").select("id,full_name,avatar_url,bio,location,school").eq("id", userId).maybeSingle(),
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", userId),
        supabase
          .from("friendships")
          .select("id, sender_id, receiver_id, profiles!friendships_sender_id_fkey(id,full_name,avatar_url), profiles!friendships_receiver_id_fkey(id,full_name,avatar_url)")
          .eq("status", "accepted")
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
          .limit(30),
        supabase
          .from("friendships")
          .select("status")
          .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUserId})`)
          .maybeSingle(),
        supabase.from("page_followers").select("page_id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("hook_pages").select("id", { count: "exact", head: true }).eq("owner_id", userId),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      setPostCount(postsRes.count ?? 0);
      setHookCount(hooksRes.count ?? 0);
      setPageCount(pagesRes.count ?? 0);

      if (friendsRes.data) {
        const parsed: Friend[] = friendsRes.data.map((row: any) => {
          const isMe = row.sender_id === userId;
          const p = isMe ? row["profiles!friendships_receiver_id_fkey"] : row["profiles!friendships_sender_id_fkey"];
          return p ? { ...p, friendshipId: row.id } : null;
        }).filter((f: Friend | null): f is Friend => !!f && !!f.id && f.id !== currentUserId);

        const allCount = friendsRes.data.length;
        setFriends(parsed);
        setFriendCount(allCount);
      }

      if (statusRes.data) setFriendStatus(statusRes.data.status as any);
      setLoading(false);
    };

    run();
  }, [userId, currentUserId]);

  const handleAddFriend = async () => {
    if (friendStatus !== "none") return;
    await supabase.from("friendships").insert({ sender_id: currentUserId, receiver_id: userId, status: "pending" });
    setFriendStatus("pending");
  };

  const handleKick = async (friend: Friend) => {
    if (!friend.friendshipId || kickingId) return;
    setKickingId(friend.id);

    await supabase.from("friendships").delete().eq("id", friend.friendshipId);

    setTimeout(() => {
      setFriends(prev => prev.filter(f => f.id !== friend.id));
      setFriendCount(prev => Math.max(0, prev - 1));
      setKickingId(null);
    }, 600);

    toast(
      <div className="flex items-center gap-2 font-bold text-sm">
        <span className="text-2xl">⚽</span>
        <span>Chal hat hawa aane de... Kicked out of the field!</span>
      </div>,
      {
        duration: 3000,
        style: {
          background: "#1a1a2e",
          color: "#fff",
          border: "1.5px solid #ef4444",
          borderRadius: "14px",
          fontFamily: "inherit",
        },
      }
    );
  };

  if (!userId) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9000] flex items-end justify-center">
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* Sheet */}
        <motion.div
          className="relative w-full max-w-md bg-white rounded-t-[2.5rem] overflow-hidden shadow-2xl"
          style={{ maxHeight: "92vh" }}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 260 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.4 }}
          onDragEnd={(_, info) => { if (info.offset.y > 100) onClose(); }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/10 flex items-center justify-center"
          >
            <X size={16} className="text-gray-600" />
          </button>

          <div className="overflow-y-auto" style={{ maxHeight: "calc(92vh - 24px)" }}>
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : profile ? (
              <>
                {/* ── Hero: Avatar + gradient bg ── */}
                <div className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 pt-6 pb-14 flex flex-col items-center gap-2 px-4">
                  <div className="w-24 h-24 rounded-full border-4 border-white shadow-xl overflow-hidden bg-blue-400 shrink-0">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} className="w-full h-full object-cover" alt={profile.full_name} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-black text-3xl">
                        {(profile.full_name || "?")[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <h2 className="text-white text-xl font-black text-center leading-tight mt-1">
                    {profile.full_name}
                  </h2>
                  {profile.bio && (
                    <p className="text-white/80 text-[13px] text-center leading-snug max-w-xs px-2">
                      {profile.bio}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                    {profile.location && (
                      <span className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1 text-white text-[11px] font-semibold">
                        <MapPin size={10} /> {profile.location}
                      </span>
                    )}
                    {profile.school && (
                      <span className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1 text-white text-[11px] font-semibold">
                        <GraduationCap size={10} /> {profile.school}
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Stats strip ── */}
                <div className="flex divide-x divide-gray-100 -mt-8 mx-4 bg-white rounded-2xl shadow-lg overflow-hidden relative z-10">
                  <div className="flex-1 flex flex-col items-center py-3">
                    <span className="text-gray-900 font-black text-lg leading-none">{postCount}</span>
                    <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide mt-0.5">Posts</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center py-3">
                    <span className="text-gray-900 font-black text-lg leading-none">{friendCount}</span>
                    <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide mt-0.5">Friends</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center py-3">
                    <span className="text-gray-900 font-black text-lg leading-none">{hookCount}</span>
                    <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide mt-0.5">Hooks</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center py-3">
                    <span className="text-gray-900 font-black text-lg leading-none">{pageCount}</span>
                    <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide mt-0.5">Pages</span>
                  </div>
                </div>

                {/* ── Action buttons (only for other users) ── */}
                {!isOwnProfile && (
                  <div className="flex gap-3 px-4 mt-4">
                    <button
                      onClick={handleAddFriend}
                      disabled={friendStatus !== "none"}
                      className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-extrabold text-lg transition-all active:scale-95 ${
                        friendStatus === "accepted"
                          ? "bg-green-100 text-green-700"
                          : friendStatus === "pending"
                          ? "bg-gray-100 text-gray-500"
                          : "text-white"
                      }`}
                      style={friendStatus === "none" ? { background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)", boxShadow: "0 6px 18px rgba(79,70,229,0.45)" } : {}}
                    >
                      {friendStatus === "accepted" ? (
                        <><Check size={18} /> Friends</>
                      ) : friendStatus === "pending" ? (
                        <><UserPlus size={18} /> Request Sent</>
                      ) : (
                        <><UserPlus size={18} /> Add Friend</>
                      )}
                    </button>
                  </div>
                )}

                {/* ── Friends list ── */}
                {isOwnProfile ? (
                  /* ── OWN PROFILE: List with KICK button ── */
                  <div className="px-4 mt-5 pb-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Users size={14} className="text-gray-500" />
                      <p className="text-[13px] font-black text-gray-700">
                        Friends ({friendCount})
                      </p>
                      {friendCount > 0 && (
                        <span className="ml-auto text-[10px] text-red-400 font-bold bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                          ⚽ Kick Mode
                        </span>
                      )}
                    </div>

                    {friends.length === 0 ? (
                      <div className="text-center py-6 text-gray-400 text-[12px] font-semibold">
                        No friends yet. Go make some! 🙌
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <AnimatePresence>
                          {friends.map((f) => (
                            <motion.div
                              key={f.id}
                              layout
                              initial={{ opacity: 1, x: 0, rotate: 0 }}
                              animate={
                                kickingId === f.id
                                  ? { x: 500, rotate: 20, opacity: 0, scale: 0.8 }
                                  : { opacity: 1, x: 0, rotate: 0, scale: 1 }
                              }
                              exit={{ x: 500, rotate: 20, opacity: 0, scale: 0.8 }}
                              transition={
                                kickingId === f.id
                                  ? { type: "spring", stiffness: 300, damping: 20, duration: 0.5 }
                                  : { duration: 0.2 }
                              }
                              className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-2.5 border border-gray-100"
                            >
                              {/* Avatar */}
                              <div
                                className="w-11 h-11 rounded-xl overflow-hidden bg-blue-100 border border-gray-200 shadow-sm shrink-0 cursor-pointer"
                                onClick={() => { onClose(); setTimeout(() => openProfile(f.id), 150); }}
                              >
                                {f.avatar_url ? (
                                  <img src={f.avatar_url} className="w-full h-full object-cover" alt={f.full_name} />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-blue-600 font-black text-base">
                                    {(f.full_name || "?")[0].toUpperCase()}
                                  </div>
                                )}
                              </div>

                              {/* Name */}
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-bold text-gray-800 truncate">{f.full_name}</p>
                                <p className="text-[10px] text-gray-400 font-medium">Friend</p>
                              </div>

                              {/* KICK Button */}
                              <motion.button
                                whileTap={{ scale: 0.88 }}
                                whileHover={{ scale: 1.06 }}
                                onClick={() => handleKick(f)}
                                disabled={!!kickingId}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-extrabold text-[12px] tracking-wide border-2 border-red-400 text-red-500 bg-red-50 hover:bg-red-500 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                                style={{ boxShadow: "0 2px 8px rgba(239,68,68,0.2)" }}
                              >
                                <span className="text-base leading-none">⚽</span>
                                KICK
                              </motion.button>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── OTHER USER'S PROFILE: Grid view ── */
                  <>
                    {friends.length > 0 && (
                      <div className="px-4 mt-5 pb-8">
                        <div className="flex items-center gap-2 mb-3">
                          <Users size={14} className="text-gray-500" />
                          <p className="text-[13px] font-black text-gray-700">Friends ({friendCount})</p>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                          {friends.slice(0, 12).map((f) => (
                            <div key={f.id} className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => { onClose(); setTimeout(() => openProfile(f.id), 150); }}>
                              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-blue-100 border border-gray-100 shadow-sm">
                                {f.avatar_url ? (
                                  <img src={f.avatar_url} className="w-full h-full object-cover" alt={f.full_name} />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-blue-600 font-black text-lg">
                                    {(f.full_name || "?")[0].toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <p className="text-[10px] text-gray-600 font-semibold text-center leading-tight truncate w-full px-0.5">
                                {f.full_name?.split(" ")[0] || "User"}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {friends.length === 0 && (
                      <div className="text-center py-6 text-gray-400 text-[12px] font-semibold pb-8">
                        No friends to show yet
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <div className="text-center py-24 text-gray-400 text-sm">Profile not found</div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default UserProfileModal;
