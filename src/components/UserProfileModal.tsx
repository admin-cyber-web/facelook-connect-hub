import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { X, MapPin, GraduationCap, BriefcaseBusiness, FileText, UserPlus, MessageCircle, Check, Users, Ban, ShieldCheck, Flag, ShieldAlert } from "lucide-react";
import { useProfileViewer } from "../context/ProfileViewerContext";
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
  username?: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
  state?: string;
  district?: string;
  city?: string;
  school?: string;
  profession?: string;
  occupation?: string;
  job_title?: string;
  work?: string;
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
  // ProfileViewerContext already derives this from the authenticated session
  // email. Do not issue another auth request just to repeat that check.
  const isAdmin = isAdminProp;
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

      type FriendshipRow = {
        id: string;
        sender_id: string;
        receiver_id: string;
        ["profiles!friendships_sender_id_fkey"]?: Friend;
        ["profiles!friendships_receiver_id_fkey"]?: Friend;
      };
      type FriendStatusRow = {
        id?: string | null;
        status: "none" | "pending" | "accepted";
      };

      const [profileRes, postsRes, friendsRes, statusRes, hooksRes, pagesRes, blockRes] = await Promise.all([
        needProfile
          ? supabase.from("profiles").select("id,full_name,username,avatar_url,bio,location,state,district,city,school,profile_locked,is_private_mode,last_seen,account_status").eq("id", userId).maybeSingle()
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
      const hc = (hooksRes as { count?: number | null }).count ?? 0;
      const pgc = (pagesRes as { count?: number | null }).count ?? 0;
      setPostCount(pc);
      setHookCount(hc);
      setPageCount(pgc);
      if (needCounts) memSet(countsKey, { postCount: pc, hookCount: hc, pageCount: pgc });

      if (needFriends && friendsRes.data) {
        const friendRows = friendsRes.data as FriendshipRow[];
        const parsed: Friend[] = friendRows.map((row) => {
          const isMe = row.sender_id === userId;
          const p = isMe ? row["profiles!friendships_receiver_id_fkey"] : row["profiles!friendships_sender_id_fkey"];
          return p ? { ...p, friendshipId: row.id } : null;
        }).filter((f: Friend | null): f is Friend => !!f && !!f.id && f.id !== currentUserId);
        const allCount = friendRows.length;
        setFriends(parsed);
        setFriendCount(allCount);
        memSet(friendsKey, { friends: parsed, count: allCount });
      } else if (cachedFriends) {
        setFriends(cachedFriends.friends);
        setFriendCount(cachedFriends.count);
      }

      const statusData = statusRes.data as FriendStatusRow | null;
      if (statusData) {
        setFriendStatus(statusData.status);
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
    if (profile?.is_private_mode && !isOwnProfile) {
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

  const profileWithFlexibleFields = profile as (ProfileData & {
    profession?: string;
    occupation?: string;
    job_title?: string;
    work?: string;
  }) | null;
  const profession = profileWithFlexibleFields?.profession
    || profileWithFlexibleFields?.occupation
    || profileWithFlexibleFields?.job_title
    || profileWithFlexibleFields?.work
    || profile?.school;
  const location = profile?.location
    || [profile?.city, profile?.district, profile?.state].filter(Boolean).join(", ");

  if (!userId) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[9000] flex items-center justify-center bg-[rgba(10,10,20,0.85)] p-3 backdrop-blur-xl sm:p-6"
        onClick={onClose}
        role="presentation"
      >
        {/* Backdrop */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,45,149,0.12),transparent_30%),radial-gradient(circle_at_85%_80%,rgba(34,211,238,0.1),transparent_32%)]" />

        {/* Neon glass modal */}
        <motion.div
          className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-transparent bg-gradient-to-br from-[#ff2d95] via-[#a855f7] to-[#22d3ee] p-[1px] shadow-[0_0_45px_rgba(168,85,247,0.28),0_0_90px_rgba(255,45,149,0.12)]"
          style={{ maxHeight: "92vh" }}
          initial={{ opacity: 0, scale: 0.94, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 24 }}
          transition={{ type: "spring", damping: 28, stiffness: 260 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.4 }}
          onDragEnd={(_, info) => { if (info.offset.y > 100) onClose(); }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={`${profile?.full_name || "User"} profile`}
        >
          <div className="relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-[#0c0817]">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              aria-label="Close profile"
              className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white/65 backdrop-blur-md transition hover:bg-white/10 hover:text-white"
            >
              <X size={17} />
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
                {/* ── Hero: avatar + dynamic profile details ── */}
                <div className="relative overflow-hidden bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,0.28),transparent_45%),linear-gradient(145deg,#1e0b2f,#10091e_58%,#081521)] px-5 pb-14 pt-8">
                  <div className="pointer-events-none absolute -left-20 -top-20 h-48 w-48 rounded-full bg-pink-500/15 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-24 -right-10 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />

                  <div className="relative mx-auto w-fit">
                    <div className="h-[142px] w-[142px] rounded-full bg-gradient-to-br from-[#ff2d95] via-[#a855f7] to-[#22d3ee] p-[3px] shadow-[0_0_26px_rgba(255,45,149,0.42),0_0_50px_rgba(34,211,238,0.18)]">
                      <div className="h-full w-full rounded-full bg-[#0e0a1b] p-[4px]">
                        <div className="h-full w-full overflow-hidden rounded-full bg-gradient-to-br from-pink-700 to-violet-900">
                          {profile.avatar_url ? (
                            <img src={profile.avatar_url} className="h-full w-full object-cover" alt={profile.full_name} decoding="async" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-4xl font-black text-white">
                              {(profile.full_name || "?")[0].toUpperCase()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {profile.last_seen && (Date.now() - new Date(profile.last_seen).getTime()) < 5 * 60 * 1000 && (
                      <span className="absolute bottom-2 right-2 h-5 w-5 rounded-full border-[3px] border-[#130b22] bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.9)]" />
                    )}
                  </div>

                  <h2 className="relative mt-4 text-center text-2xl font-black leading-tight text-white [text-shadow:0_0_18px_rgba(255,45,149,0.35)]">
                    {profile.full_name}
                  </h2>
                  {profile.username && (
                    <p className="relative mt-1 text-center text-[11px] font-semibold tracking-wide text-white/40">
                      @{profile.username}
                    </p>
                  )}
                  {profession && (
                    <div className="relative mx-auto mt-3 flex w-fit items-center gap-1.5 rounded-full border border-pink-300/25 bg-gradient-to-r from-pink-500/25 to-violet-500/25 px-3 py-1.5 text-[11px] font-bold text-pink-100 shadow-[0_0_18px_rgba(255,45,149,0.16)]">
                      <BriefcaseBusiness size={13} className="text-pink-300" />
                      {profession}
                    </div>
                  )}
                  {location && (
                    <div className="relative mt-3 flex items-center justify-center gap-1.5 text-[12px] font-semibold text-cyan-100/75">
                      <MapPin size={14} className="text-cyan-300" />
                      {location}
                    </div>
                  )}
                  {profile.bio && (
                    <p className="relative mx-auto mt-3 max-w-sm text-center text-[13px] leading-relaxed text-white/55">
                      {profile.bio}
                    </p>
                  )}
                </div>

                {/* ── Stats strip ── */}
                <div className="relative z-10 -mt-8 grid grid-cols-3 gap-2 px-4">
                  <div className="rounded-2xl border border-pink-300/15 bg-white/[0.07] px-2 py-3 text-center shadow-[0_0_18px_rgba(255,45,149,0.08)] backdrop-blur-md">
                    <FileText size={18} className="mx-auto mb-1 text-pink-300 drop-shadow-[0_0_7px_rgba(255,45,149,0.9)]" />
                    <span className="block text-xl font-black leading-none text-white">{postCount}</span>
                    <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-pink-100/45">Posts</span>
                  </div>
                  <div className="rounded-2xl border border-violet-300/15 bg-white/[0.07] px-2 py-3 text-center shadow-[0_0_18px_rgba(168,85,247,0.08)] backdrop-blur-md">
                    <Users size={18} className="mx-auto mb-1 text-violet-300 drop-shadow-[0_0_7px_rgba(168,85,247,0.9)]" />
                    <span className="block text-xl font-black leading-none text-white">{friendCount}</span>
                    <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-violet-100/45">Friends</span>
                  </div>
                  <div className="rounded-2xl border border-cyan-300/15 bg-white/[0.07] px-2 py-3 text-center shadow-[0_0_18px_rgba(34,211,238,0.08)] backdrop-blur-md">
                    <GraduationCap size={18} className="mx-auto mb-1 text-cyan-300 drop-shadow-[0_0_7px_rgba(34,211,238,0.9)]" />
                    <span className="block text-xl font-black leading-none text-white">{hookCount}</span>
                    <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-cyan-100/45">Hooks</span>
                  </div>
                </div>

                {/* ── Action buttons (only for other users) ── */}
                {!isOwnProfile && (
                  <>
                    {/* Primary row: Friend + Message */}
                    <div className="flex gap-2.5 px-4 mt-4">
                      {friendStatus === "accepted" ? (
                        <button
                          onClick={handleUnfriend}
                          disabled={actionBusy}
                          className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-400/15 py-3.5 text-[15px] font-extrabold text-emerald-200 transition-all active:scale-95 disabled:opacity-50"
                        >
                          <Check size={17} /> Friends
                        </button>
                      ) : friendStatus === "pending" ? (
                        <button
                          disabled
                          className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 py-3.5 text-[15px] font-extrabold text-white/45"
                        >
                          <UserPlus size={17} /> Requested
                        </button>
                      ) : (
                        <button
                          onClick={handleAddFriend}
                          disabled={actionBusy || isBlocked}
                          className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-extrabold text-white transition-all active:scale-95 disabled:opacity-50"
                          style={{ background: "linear-gradient(135deg,#ff2d95,#a855f7)", boxShadow: "0 0 24px rgba(255,45,149,0.28)" }}
                        >
                          <UserPlus size={17} /> Add Friend
                        </button>
                      )}

                      <button
                        onClick={handleMessage}
                        disabled={isBlocked}
                        className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-extrabold text-white transition-all active:scale-95 disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg,#22d3ee,#2563eb)", boxShadow: "0 0 24px rgba(34,211,238,0.22)" }}
                      >
                        <MessageCircle size={17} /> Message
                      </button>
                    </div>

                    {/* Secondary row: moderation actions */}
                    <div className={`grid gap-2 px-4 mt-2.5 ${isAdmin ? "grid-cols-3" : "grid-cols-2"}`}>
                      {isAdmin && (
                        <button
                          onClick={handleAdminBanToggle}
                          className="flex items-center justify-center gap-1.5 rounded-xl border border-red-400/25 bg-red-500/10 py-2.5 text-[11px] font-bold text-red-300 transition-all hover:bg-red-500/20 active:scale-95"
                        >
                          {profile.account_status === "suspended" ? (
                            <><ShieldCheck size={13} /> Unban</>
                          ) : (
                            <><Ban size={13} /> Ban Account</>
                          )}
                        </button>
                      )}
                      <button
                        onClick={handleToggleBlock}
                        disabled={actionBusy}
                        className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[11px] font-bold transition-all active:scale-95 disabled:opacity-50 ${
                          isBlocked
                            ? "border-amber-300/25 bg-amber-500/10 text-amber-200"
                            : "border-red-400/20 bg-white/[0.04] text-red-300 hover:bg-red-500/10"
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
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-red-400/20 bg-white/[0.04] py-2.5 text-[11px] font-bold text-red-300 transition-all hover:bg-red-500/10 active:scale-95"
                      >
                        <Flag size={13} /> Report
                      </button>
                    </div>

                    {isBlocked && (
                      <div className="mx-4 mt-2 flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-500/10 p-2 text-[11px] font-bold text-amber-200">
                        <ShieldAlert size={13} />
                        You have blocked this user. Their content is hidden everywhere.
                      </div>
                    )}
                  </>
                )}

                {/* ── Friends list ── */}
                {isOwnProfile ? (
                  /* ── OWN PROFILE: List with KICK button ── */
                  <div className="px-4 pb-8 pt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Users size={14} className="text-violet-300" />
                      <p className="text-[13px] font-black text-white/80">
                        Friends ({friendCount})
                      </p>
                      {friendCount > 0 && (
                        <span className="ml-auto rounded-full border border-red-300/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-300">
                          ⚽ Kick Mode
                        </span>
                      )}
                    </div>

                    {friends.length === 0 ? (
                      <div className="py-6 text-center text-[12px] font-semibold text-white/35">
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
                              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5"
                            >
                              {/* Avatar */}
                              <div
                                 className="h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-violet-300/20 bg-violet-900/40 shadow-sm"
                                onClick={() => { onClose(); setTimeout(() => openProfile(f.id), 150); }}
                              >
                                {f.avatar_url ? (
                                  <img src={f.avatar_url} className="w-full h-full object-cover" alt={f.full_name}  decoding="async"/>
                                ) : (
                                   <div className="flex h-full w-full items-center justify-center text-base font-black text-violet-200">
                                    {(f.full_name || "?")[0].toUpperCase()}
                                  </div>
                                )}
                              </div>

                              {/* Name */}
                              <div className="flex-1 min-w-0">
                                 <p className="truncate text-[13px] font-bold text-white/80">{f.full_name}</p>
                                 <p className="text-[10px] font-medium text-white/35">Friend</p>
                              </div>

                              {/* KICK Button */}
                              <motion.button
                                whileTap={{ scale: 0.88 }}
                                whileHover={{ scale: 1.06 }}
                                onClick={() => handleKick(f)}
                                disabled={!!kickingId}
                                 className="flex shrink-0 items-center gap-1.5 rounded-xl border border-red-400/35 bg-red-500/10 px-3 py-2 text-[12px] font-extrabold tracking-wide text-red-300 transition-colors hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
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
                       <div className="px-4 pb-8 pt-6">
                        <div className="flex items-center gap-2 mb-3">
                          <Users size={14} className="text-violet-300" />
                          <p className="text-[13px] font-black text-white/80">Friends ({friendCount})</p>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                          {friends.slice(0, 12).map((f) => (
                            <div key={f.id} className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => { onClose(); setTimeout(() => openProfile(f.id), 150); }}>
                               <div className="h-14 w-14 overflow-hidden rounded-2xl border border-violet-300/20 bg-violet-900/40 shadow-sm">
                                {f.avatar_url ? (
                                  <img src={f.avatar_url} className="w-full h-full object-cover" alt={f.full_name}  decoding="async"/>
                                ) : (
                                   <div className="flex h-full w-full items-center justify-center text-lg font-black text-violet-200">
                                    {(f.full_name || "?")[0].toUpperCase()}
                                  </div>
                                )}
                              </div>
                               <p className="w-full truncate px-0.5 text-center text-[10px] font-semibold leading-tight text-white/50">
                                {f.full_name?.split(" ")[0] || "User"}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {friends.length === 0 && (
                       <div className="pb-8 py-6 text-center text-[12px] font-semibold text-white/35">
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
                className="w-72 rounded-2xl border border-red-300/20 bg-[#160d24]/98 p-4 text-white shadow-[0_0_35px_rgba(239,68,68,0.18)] backdrop-blur-xl"
                onClick={(e) => e.stopPropagation()}
              >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/15">
                    <Flag size={15} className="text-rose-300" />
                </div>
                <div>
                   <p className="text-sm font-black leading-none text-white">Report user</p>
                   <p className="mt-0.5 text-[10px] text-white/40">Admin will review your report</p>
                </div>
              </div>
              <button
                onClick={() => setReportOpen(false)}
                 className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/55 transition-colors hover:bg-white/20"
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
                       ? "border-rose-300/50 bg-rose-500/20 text-rose-100"
                       : "border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/10"
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
              className="mb-3 w-full resize-none rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-rose-300/60"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setReportOpen(false)}
                disabled={reportSubmitting}
                 className="flex-1 rounded-xl bg-white/10 py-2.5 text-sm font-bold text-white/60 disabled:opacity-50"
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
