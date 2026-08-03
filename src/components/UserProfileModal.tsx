import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { X, MapPin, GraduationCap, UserPlus, MessageCircle, Check, Users, Ban, ShieldCheck, UserMinus, Flag, ShieldAlert } from "lucide-react";
import { useProfileViewer } from "../context/ProfileViewerContext";
import { isAdminEmail } from "../lib/adminConfig";
import { toast } from "sonner";
import { memGet, memSet } from "../lib/memCache";

interface Props {
  userId: string;
  currentUserId: string;
  isAdmin?: boolean;
  onClose: () => void;
}

interface ProfileData {
  id: string;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
  school?: string;
  profile_locked?: boolean;
  is_private_mode?: boolean;
  last_seen?: string;
  account_status?: string | null;
}

interface Friend {
  id: string;
  full_name: string;
  avatar_url?: string;
  friendshipId?: string;
}

const UserProfileModal = ({ userId, currentUserId, isAdmin: isAdminProp = false, onClose }: Props) => {
  const { openProfile } = useProfileViewer();
  const [myEmail, setMyEmail] = useState<string | null>(null);
  // Robust admin detection: trust prop OR fall back to fetched email of logged-in user
  const isAdmin = isAdminProp || isAdminEmail(myEmail);
  const [profile, setProfile]         = useState<ProfileData | null>(null);
  const [friends, setFriends]         = useState<Friend[]>([]);
  const [postCount, setPostCount]     = useState(0);
  const [friendCount, setFriendCount] = useState(0);
  const [hookCount, setHookCount]     = useState(0);
  const [pageCount, setPageCount]     = useState(0);
  const [friendStatus, setFriendStatus] = useState<"none" | "pending" | "accepted">("none");
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [kickingId, setKickingId]     = useState<string | null>(null);
  const [isBlocked, setIsBlocked]     = useState(false);
  const [actionBusy, setActionBusy]   = useState(false);
  const [reportOpen, setReportOpen]   = useState(false);
  const [reportAnchor, setReportAnchor] = useState<{ top: number; right: number } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const dragY = useRef(0);

  const isOwnProfile = userId === currentUserId;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyEmail(data.user?.email ?? null));
  }, []);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);

    const run = async () => {
      // ── Cache keys ────────────────────────────────────────────────────────
      const profileKey  = `upm:profile:${userId}`;
      const friendsKey  = `upm:friends:${userId}`;
      const countsKey   = `upm:counts:${userId}`;
      const statusKey   = `upm:status:${currentUserId}:${userId}`;
      const blockKey    = `upm:block:${currentUserId}:${userId}`;

      type CachedCounts = { postCount: number; hookCount: number; pageCount: number };

      const cachedProfile = memGet<ProfileData>(profileKey);
      const cachedFriends = memGet<{ friends: Friend[]; count: number }>(friendsKey);
      const cachedCounts  = memGet<CachedCounts>(countsKey);
      const cachedStatus  = memGet<{ status: string; id: string | null }>(statusKey);
      const cachedBlock   = memGet<boolean>(blockKey);

      // Determine which requests are still needed
      const needProfile = !cachedProfile;
      const needFriends = !cachedFriends;
      const needCounts  = !cachedCounts;
      const needStatus  = !cachedStatus;
      const needBlock   = !cachedBlock && !isOwnProfile;

      const [profileRes, postsRes, friendsRes, statusRes, hooksRes, pagesRes, blockRes] = await Promise.all([
        needProfile
          ? supabase.from("profiles").select("id,full_name,avatar_url,bio,location,school,profile_locked,is_private_mode,last_seen,account_status").eq("id", userId).maybeSingle()
          : Promise.resolve({ data: cachedProfile }),
        needCounts
          ? supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", userId)
          : Promise.resolve({ count: cachedCounts!.postCount }),
        needFriends
          ? supabase
              .from("friendships")
              .select("id, sender_id, receiver_id, profiles!friendships_sender_id_fkey(id,full_name,avatar_url), profiles!friendships_receiver_id_fkey(id,full_name,avatar_url)")
              .eq("status", "accepted")
              .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
              .limit(30)
          : Promise.resolve({ data: null }),
        needStatus
          ? supabase
              .from("friendships")
              .select("id, status")
              .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUserId})`)
              .maybeSingle()
          : Promise.resolve({ data: cachedStatus }),
        needCounts
          ? supabase.from("page_followers").select("page_id", { count: "exact", head: true }).eq("user_id", userId)
          : Promise.resolve({ count: cachedCounts!.hookCount }),
        needCounts
          ? supabase.from("hook_pages").select("id", { count: "exact", head: true }).eq("owner_id", userId)
          : Promise.resolve({ count: cachedCounts!.pageCount }),
        needBlock
          ? supabase
              .from("user_blocks")
              .select("blocked_id")
              .eq("blocker_id", currentUserId)
              .eq("blocked_id", userId)
              .maybeSingle()
          : Promise.resolve({ data: isOwnProfile ? null : (cachedBlock ? { blocked_id: userId } : null) }),
      ]);

      // ── Apply results + populate cache ─────────────────────────────────
      if (profileRes.data) {
        setProfile(profileRes.data);
        if (needProfile) memSet(profileKey, profileRes.data);
      }

      const pc = postsRes.count ?? 0;
      const hc = (hooksRes as any).count ?? 0;
      const pgc = (pagesRes as any).count ?? 0;
      setPostCount(pc);
      setHookCount(hc);
      setPageCount(pgc);
      if (needCounts) memSet(countsKey, { postCount: pc, hookCount: hc, pageCount: pgc });

      if (needFriends && friendsRes.data) {
        const parsed: Friend[] = (friendsRes.data as any[]).map((row: any) => {
          const isMe = row.sender_id === userId;
          const p = isMe ? row["profiles!friendships_receiver_id_fkey"] : row["profiles!friendships_sender_id_fkey"];
          return p ? { ...p, friendshipId: row.id } : null;
        }).filter((f: Friend | null): f is Friend => !!f && !!f.id && f.id !== currentUserId);
        const allCount = (friendsRes.data as any[]).length;
        setFriends(parsed);
        setFriendCount(allCount);
        memSet(friendsKey, { friends: parsed, count: allCount });
      } else if (cachedFriends) {
        setFriends(cachedFriends.friends);
        setFriendCount(cachedFriends.count);
      }

      const statusData = statusRes.data as any;
      if (statusData) {
        setFriendStatus(statusData.status as any);
        setFriendshipId(statusData.id || null);
        if (needStatus) memSet(statusKey, { status: statusData.status, id: statusData.id || null });
      } else {
        setFriendStatus("none");
        setFriendshipId(null);
        if (needStatus) memSet(statusKey, { status: "none", id: null });
      }

      const blocked = !!blockRes.data;
      setIsBlocked(blocked);
      if (needBlock) memSet(blockKey, blocked);

      setLoading(false);
    };

    run();
  }, [userId, currentUserId, isOwnProfile]);

  const handleAdminBanToggle = async () => {
    if (!profile || !isAdmin) return;
    const isBanned = profile.account_status === "suspended";
    if (isBanned) {
      const { error } = await supabase.from("profiles")
        .update({ account_status: "active", suspension_reason: null })
        .eq("id", userId);
      if (error) { toast.error("Could not unban user"); return; }
      setProfile({ ...profile, account_status: "active" });
      toast.success("✅ User unbanned");
    } else {
      const reason = window.prompt("Reason for banning this user?", "Violated community guidelines");
      if (!reason || !reason.trim()) return;
      const { error } = await supabase.from("profiles")
        .update({ account_status: "suspended", suspension_reason: reason.trim() })
        .eq("id", userId);
      if (error) { toast.error("Could not ban user"); return; }
      setProfile({ ...profile, account_status: "suspended" });
      toast.success("🚫 User banned");
    }
  };

  const handleAddFriend = async () => {
    if (friendStatus !== "none" || actionBusy) return;
    if (profile?.is_private_mode && friendStatus !== "accepted" && !isOwnProfile) {
      toast.error("This user has enabled Private Mode. You cannot disturb them until they turn it off.");
      return;
    }
    setActionBusy(true);
    const { data, error } = await supabase
      .from("friendships")
      .insert({ sender_id: currentUserId, receiver_id: userId, status: "pending" })
      .select("id")
      .maybeSingle();
    setActionBusy(false);
    if (error) { toast.error("Could not send request"); return; }
    setFriendStatus("pending");
    if (data?.id) setFriendshipId(data.id);
    toast.success("Friend request sent");
  };

  const handleUnfriend = async () => {
    if (friendStatus !== "accepted" || actionBusy) return;
    if (!window.confirm("Unfriend this person?")) return;
    setActionBusy(true);
    if (friendshipId) {
      await supabase.from("friendships").delete().eq("id", friendshipId);
    } else {
      await supabase
        .from("friendships")
        .delete()
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUserId})`);
    }
    setActionBusy(false);
    setFriendStatus("none");
    setFriendshipId(null);
    setFriendCount(c => Math.max(0, c - 1));
    toast.success("Unfriended");
  };

  const handleMessage = () => {
    if (isBlocked) { toast.error("Unblock this user to message them"); return; }
    if (profile?.is_private_mode && friendStatus !== "accepted" && !isOwnProfile) {
      toast.error("This user has enabled Private Mode. You cannot disturb them until they turn it off.");
      return;
    }
    if (!profile) return;
    // Tell the chat system to open this conversation. ChatSystem listens
    // for this event and will route to inbox if friends, requests if not.
    window.dispatchEvent(new CustomEvent("flicks:open-chat", {
      detail: {
        userId: profile.id,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
      },
    }));
    onClose();
  };

  const handleToggleBlock = async () => {
    if (actionBusy) return;
    setActionBusy(true);
    if (isBlocked) {
      const { error } = await supabase
        .from("user_blocks")
        .delete()
        .eq("blocker_id", currentUserId)
        .eq("blocked_id", userId);
      setActionBusy(false);
      if (error) { toast.error("Could not unblock"); return; }
      setIsBlocked(false);
      toast.success("Unblocked");
    } else {
      if (!window.confirm("Block this user? You will no longer see each other's content.")) {
        setActionBusy(false);
        return;
      }
      const { error } = await supabase
        .from("user_blocks")
        .insert({ blocker_id: currentUserId, blocked_id: userId });
      // Also remove any existing friendship
      if (!error) {
        await supabase
          .from("friendships")
          .delete()
          .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUserId})`);
        setFriendStatus("none");
        setFriendshipId(null);
      }
      setActionBusy(false);
      if (error && !error.message?.toLowerCase().includes("duplicate")) {
        toast.error("Could not block");
        return;
      }
      setIsBlocked(true);
      toast.success("User blocked");
    }
  };

  const handleSubmitReport = async () => {
    const reason = reportReason.trim();
    if (!reason) return;
    setReportSubmitting(true);
    const { error } = await supabase.from("reports").insert({
      reporter_id: currentUserId,
      target_id: userId,
      reason,
    });
    setReportSubmitting(false);
    if (error) {
      toast.error("Could not submit report");
      return;
    }
    setReportOpen(false);
    setReportReason("");
    toast.success("Report submitted. Admin team will review it.");
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
            ) : profile && profile.is_private_mode && !isOwnProfile && friendStatus !== "accepted" ? (
              /* ── PRIVATE MODE SCREEN ── */
              <div className="flex flex-col items-center justify-center py-16 px-8 gap-5">
                <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-purple-300 shadow-xl bg-gradient-to-br from-purple-600 to-indigo-700 shrink-0 flex items-center justify-center">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} className="w-full h-full object-cover opacity-30" alt=""  decoding="async"/>
                  ) : (
                    <span className="text-5xl">🛡️</span>
                  )}
                </div>
                <div className="text-5xl leading-none">🚫</div>
                <div className="text-center">
                  <p className="text-gray-900 font-black text-xl leading-tight">{profile.full_name}</p>
                  <p className="text-purple-600 font-black text-sm mt-1 uppercase tracking-widest">Private Mode Enabled</p>
                  <p className="text-gray-500 text-[13px] font-semibold mt-3 leading-snug max-w-[260px] mx-auto">
                    This user has enabled Private Mode. You cannot disturb them until they turn it off.
                  </p>
                </div>
              </div>
            ) : profile && profile.profile_locked && !isOwnProfile && friendStatus !== "accepted" ? (
              /* ── LOCKED PROFILE SCREEN ── */
              <div className="flex flex-col items-center justify-center py-16 px-8 gap-5">
                <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-red-300 shadow-xl bg-gradient-to-br from-red-500 to-orange-600 shrink-0 flex items-center justify-center">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} className="w-full h-full object-cover opacity-30" alt=""  decoding="async"/>
                  ) : (
                    <span className="text-5xl">🔐</span>
                  )}
                </div>
                <div className="text-5xl leading-none">🚫</div>
                <div className="text-center">
                  <p className="text-gray-900 font-black text-xl leading-tight">{profile.full_name}</p>
                  <p className="text-red-500 font-black text-sm mt-1 uppercase tracking-widest">Profile Locked</p>
                  <p className="text-gray-400 text-[12px] font-medium mt-2 leading-snug max-w-[220px] mx-auto">
                    This user has locked their profile. Only friends can view their details.
                  </p>
                </div>
                <div className="w-full max-w-[280px] bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                  <span className="text-2xl">⚠️</span>
                  <p className="text-red-700 text-[11px] font-bold leading-snug">
                    Friends list, posts, hooks aur baaki details sirf friends ko dikhti hain.
                  </p>
                </div>
                {friendStatus === "none" && (
                  <button
                    onClick={handleAddFriend}
                    className="w-full max-w-[280px] py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    style={{ background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)", boxShadow: "0 6px 18px rgba(79,70,229,0.35)" }}
                  >
                    <UserPlus size={18} /> Send Friend Request
                  </button>
                )}
                {friendStatus === "pending" && (
                  <div className="w-full max-w-[280px] py-4 rounded-2xl bg-gray-100 text-gray-500 font-black text-base flex items-center justify-center gap-2">
                    <UserPlus size={18} /> Request Sent
                  </div>
                )}
              </div>
            ) : profile ? (
              <>
                {/* ── Hero: Avatar + gradient bg ── */}
                <div className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 pt-6 pb-14 flex flex-col items-center gap-2 px-4">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full border-4 border-white shadow-xl overflow-hidden bg-blue-400 shrink-0">
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} className="w-full h-full object-cover" alt={profile.full_name}  decoding="async"/>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white font-black text-3xl">
                          {(profile.full_name || "?")[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    {profile.last_seen && (Date.now() - new Date(profile.last_seen).getTime()) < 5 * 60 * 1000 && (
                      <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-white" />
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

                {/* ── Admin Ban / Unban Button (red, always visible to admin) ── */}
                {isAdmin && !isOwnProfile && (
                  <div className="px-4 mt-4">
                    <button
                      onClick={handleAdminBanToggle}
                      className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm text-white active:scale-95 transition-transform ${
                        profile.account_status === "suspended" ? "" : ""
                      }`}
                      style={{
                        background: profile.account_status === "suspended"
                          ? "linear-gradient(135deg,#16a34a,#166534)"
                          : "linear-gradient(135deg,#ef4444,#991b1b)",
                        boxShadow: "0 6px 18px rgba(239,68,68,0.35)",
                      }}
                    >
                      {profile.account_status === "suspended" ? (
                        <><ShieldCheck size={16} /> Unban Account (Admin)</>
                      ) : (
                        <><Ban size={16} /> Ban Account (Admin)</>
                      )}
                    </button>
                    {profile.account_status === "suspended" && (
                      <p className="text-center text-[11px] text-red-500 font-bold mt-2">
                        🚫 This account is currently suspended
                      </p>
                    )}
                  </div>
                )}

                {/* ── Action buttons (only for other users) ── */}
                {!isOwnProfile && (
                  <>
                    {/* Primary row: Friend + Message */}
                    <div className="flex gap-2.5 px-4 mt-4">
                      {friendStatus === "accepted" ? (
                        <button
                          onClick={handleUnfriend}
                          disabled={actionBusy}
                          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-extrabold text-[15px] active:scale-95 transition-all bg-emerald-100 text-emerald-700 border border-emerald-200 disabled:opacity-50"
                        >
                          <Check size={17} /> Friends
                        </button>
                      ) : friendStatus === "pending" ? (
                        <button
                          disabled
                          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-extrabold text-[15px] bg-gray-100 text-gray-500"
                        >
                          <UserPlus size={17} /> Requested
                        </button>
                      ) : (
                        <button
                          onClick={handleAddFriend}
                          disabled={actionBusy || isBlocked}
                          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-extrabold text-[15px] text-white active:scale-95 transition-all disabled:opacity-50"
                          style={{ background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)", boxShadow: "0 6px 18px rgba(79,70,229,0.45)" }}
                        >
                          <UserPlus size={17} /> Add Friend
                        </button>
                      )}

                      <button
                        onClick={handleMessage}
                        disabled={isBlocked}
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-extrabold text-[15px] bg-white text-blue-600 border border-blue-200 active:scale-95 transition-all disabled:opacity-50"
                      >
                        <MessageCircle size={17} /> Message
                      </button>
                    </div>

                    {/* Secondary row: Unfriend (when friends), Block, Report */}
                    <div className="flex gap-2 px-4 mt-2.5">
                      {friendStatus === "accepted" && (
                        <button
                          onClick={handleUnfriend}
                          disabled={actionBusy}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-[12px] bg-gray-50 text-gray-700 border border-gray-200 active:scale-95 transition-all disabled:opacity-50"
                        >
                          <UserMinus size={13} /> Unfriend
                        </button>
                      )}
                      <button
                        onClick={handleToggleBlock}
                        disabled={actionBusy}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-[12px] active:scale-95 transition-all disabled:opacity-50 ${
                          isBlocked
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-gray-50 text-gray-700 border border-gray-200"
                        }`}
                      >
                        {isBlocked ? (
                          <><ShieldCheck size={13} /> Unblock</>
                        ) : (
                          <><Ban size={13} /> Block</>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          const popupH = 400;
                          const spaceBelow = window.innerHeight - e.clientY;
                          const top = spaceBelow >= popupH + 16
                            ? e.clientY + 8
                            : Math.max(8, e.clientY - popupH - 8);
                          setReportAnchor({ top, right: 16 });
                          setReportReason("");
                          setReportOpen(true);
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-[12px] bg-rose-50 text-rose-600 border border-rose-200 active:scale-95 transition-all"
                      >
                        <Flag size={13} /> Report
                      </button>
                    </div>

                    {isBlocked && (
                      <div className="mx-4 mt-2 p-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-700 font-bold flex items-center gap-2">
                        <ShieldAlert size={13} />
                        You have blocked this user. Their content is hidden everywhere.
                      </div>
                    )}
                  </>
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
                                  <img src={f.avatar_url} className="w-full h-full object-cover" alt={f.full_name}  decoding="async"/>
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
                                  <img src={f.avatar_url} className="w-full h-full object-cover" alt={f.full_name}  decoding="async"/>
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

      {/* Report sheet */}
      {createPortal(
        <AnimatePresence>
          {reportOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => !reportSubmitting && setReportOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                style={{ zIndex: 99998 }}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ type: "spring", stiffness: 320, damping: 30 }}
                style={{
                  position: "fixed",
                  top: reportAnchor?.top ?? 120,
                  right: reportAnchor?.right ?? 16,
                  zIndex: 99999,
                }}
                className="w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4"
                onClick={(e) => e.stopPropagation()}
              >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center">
                  <Flag size={15} className="text-rose-500" />
                </div>
                <div>
                  <p className="text-gray-900 font-black text-sm leading-none">Report user</p>
                  <p className="text-gray-400 text-[10px] mt-0.5">Admin will review your report</p>
                </div>
              </div>
              <button
                onClick={() => setReportOpen(false)}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 mb-3">
              {["Spam or scam", "Harassment or bullying", "Hate speech", "Inappropriate content", "Fake account", "Other"].map(r => (
                <button
                  key={r}
                  onClick={() => setReportReason(r)}
                  className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all ${
                    reportReason === r
                      ? "bg-rose-50 border-rose-300 text-rose-700"
                      : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Add details (optional)…"
              rows={2}
              className="w-full rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-gray-50 border border-gray-200 outline-none resize-none mb-3 focus:border-rose-300"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setReportOpen(false)}
                disabled={reportSubmitting}
                className="flex-1 py-2.5 rounded-xl text-gray-600 bg-gray-100 font-bold text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={reportSubmitting || !reportReason.trim()}
                className="flex-1 py-2.5 rounded-xl text-white font-black text-sm disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#ef4444,#b91c1c)" }}
              >
                {reportSubmitting ? "Submitting…" : "Submit"}
              </button>
            </div>
            </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </AnimatePresence>
  );
};

export default UserProfileModal;
