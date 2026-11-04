import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useInRouterContext, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import {
  X,
  MoreVertical,
  MessageCircle,
  UserRound,
  UserRoundPlus,
  Shield,
  Clock3,
  ChevronRight,
  BriefcaseBusiness,
  GraduationCap,
  Home,
  MapPin,
  Play,
  Image as ImageIcon,
  UsersRound,
  Flag,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  userId?: string | null;
  currentUserId?: string | null;
  onClose: () => void;
  isAdmin?: boolean;
}

interface ProfileData {
  id: string;
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  location?: string | null;
  city?: string | null;
  state?: string | null;
  district?: string | null;
  school?: string | null;
  work?: string | null;
  profession?: string | null;
  job_title?: string | null;
  occupation?: string | null;
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

interface ActivityItem {
  id: string;
  icon: React.ElementType;
  title: string;
  detail: string;
  to: string;
  tone: "mint" | "pink" | "blue" | "lilac";
}

const ACTIVITY_COLORS: Record<string, { bg: string; color: string }> = {
  mint: { bg: "#e4f6ef", color: "#189c8b" },
  pink: { bg: "#faedf0", color: "#cf8193" },
  blue: { bg: "#e9f4f6", color: "#5d9cac" },
  lilac: { bg: "#f0edfa", color: "#8d81b4" },
};

const TEAL = "#169c9a";
const DEEP_TEAL = "#087d81";

const formatLastSeen = (iso?: string | null): string => {
  if (!iso) return "Last Seen : --";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "Last Seen : --";
    const day = d.toLocaleDateString(undefined, { weekday: "short" });
    const time = d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    return `Last Seen : ${day} ${time}`;
  } catch {
    return "Last Seen : --";
  }
};

const UserProfilePreviewModalContent = ({
  userId: userIdProp,
  currentUserId: currentUserIdProp,
  onClose,
  isAdmin: isAdminProp = false,
}: Props) => {
  const userId = userIdProp?.trim() || "";
  const currentUserId = currentUserIdProp?.trim() || "";
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [postCount, setPostCount] = useState(0);
  const [friendCount, setFriendCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [friendStatus, setFriendStatus] = useState<
    "none" | "pending" | "accepted"
  >("none");
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 12 });
  const [isBlocked, setIsBlocked] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isOwnProfile = userId === currentUserId;
  const isLocked = !!profile?.profile_locked || !!profile?.is_private_mode;
  const isPublic = !isLocked;

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !menuButtonRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () =>
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, [menuOpen]);

  // ── Data loading ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setFriends([]);
      setPostCount(0);
      setFriendCount(0);
      setFollowingCount(0);
      setFollowerCount(0);
      setActivity([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setProfile(null);

    const run = async () => {
      const profileKey = `ppm:profile:${userId}`;
      const friendsKey = `ppm:friends:${userId}:${currentUserId}`;
      const { memGet, memSet } = await import("../lib/memCache");

      const cachedProfile = memGet<ProfileData>(profileKey);
      const cachedFriends = memGet<{ friends: Friend[]; count: number }>(
        friendsKey
      );

      const needProfile = !cachedProfile;
      const needFriends = !cachedFriends;

      const [
        profileRes,
        friendsRes,
        currentFriendsRes,
        blockRes,
        statusRes,
        postsCountRes,
        followingCountRes,
        followerCountRes,
        activityRes,
      ] =
        await Promise.all([
          needProfile
            ? supabase
                .from("profiles")
                .select(
                  "id,full_name,username,avatar_url,bio,location,city,state,district,school,work,profession,profile_locked,is_private_mode,last_seen,account_status"
                )
                .eq("id", userId)
                .maybeSingle()
            : Promise.resolve({ data: cachedProfile }),
          needFriends
            ? supabase
                .from("friendships")
                .select("id, sender_id, receiver_id", { count: "exact" })
                .eq("status", "accepted")
                .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
                .limit(30)
            : Promise.resolve({ data: null, count: null }),
          needFriends && currentUserId
            ? supabase
                .from("friendships")
                .select("sender_id, receiver_id")
                .eq("status", "accepted")
                .or(
                  `sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`,
                )
                .limit(100)
            : Promise.resolve({ data: null }),
          !isOwnProfile && currentUserId
            ? supabase
                .from("user_blocks")
                .select("blocked_id")
                .eq("blocker_id", currentUserId)
                .eq("blocked_id", userId)
                .maybeSingle()
            : Promise.resolve({ data: null }),
          !isOwnProfile && currentUserId
            ? supabase
                .from("friendships")
                .select("id, status")
                .or(
                  `and(sender_id.eq.${currentUserId},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUserId})`
                )
                .maybeSingle()
            : Promise.resolve({ data: null }),
          supabase
            .from("posts")
            .select("id", { count: "exact", head: true })
            .eq("author_id", userId),
          supabase
            .from("follows")
            .select("following_id", { count: "exact", head: true })
            .eq("follower_id", userId),
          supabase
            .from("follows")
            .select("follower_id", { count: "exact", head: true })
            .eq("following_id", userId),
          supabase
            .from("posts")
            .select("id, author_id, content, type, media_type, created_at, visibility")
            .eq("author_id", userId)
            .eq("visibility", "public")
            .order("created_at", { ascending: false })
            .limit(3),
        ]);

      if (!active) return;

      const logQueryError = (label: string, result: unknown) => {
        if (
          result &&
          typeof result === "object" &&
          "error" in result &&
          result.error
        ) {
          console.error(
            `[UserProfilePreviewModal] ${label} query failed:`,
            result.error,
          );
        }
      };
      logQueryError("profile", profileRes);
      logQueryError("friendships", friendsRes);
      logQueryError("posts count", postsCountRes);
      logQueryError("following count", followingCountRes);
      logQueryError("follower count", followerCountRes);
      logQueryError("public activity", activityRes);

      if (profileRes.data && typeof profileRes.data.id === "string") {
        setProfile(profileRes.data as ProfileData);
        if (needProfile) memSet(profileKey, profileRes.data);
      } else {
        setProfile(null);
      }

      if (friendsRes.data) {
        const rows = friendsRes.data as Array<{
          id: string;
          sender_id: string;
          receiver_id: string;
        }>;
        const targetFriendIds = rows
          .map((row) => {
            return row.sender_id === userId ? row.receiver_id : row.sender_id;
          })
          .filter((friendId) => friendId !== currentUserId);
        const currentFriendIds = new Set(
          ((currentFriendsRes.data ?? []) as Array<{
            sender_id: string;
            receiver_id: string;
          }>).map((row) =>
            row.sender_id === currentUserId ? row.receiver_id : row.sender_id,
          ),
        );
        const mutualIds = targetFriendIds.filter((friendId) =>
          currentFriendIds.has(friendId),
        );
        const friendProfiles =
          mutualIds.length > 0
            ? await supabase
                .from("profiles")
                .select("id, full_name, avatar_url")
                .in("id", mutualIds)
            : { data: [] };
        if (!active) return;
        logQueryError("mutual friend profiles", friendProfiles);
        const profileById = new Map(
          (friendProfiles.data ?? []).map((friend) => [friend.id, friend]),
        );
        const parsed: Friend[] = mutualIds.map((id) => {
          const friendProfile = profileById.get(id);
          return {
            id,
            full_name: friendProfile?.full_name || "Flicks member",
            avatar_url: friendProfile?.avatar_url || undefined,
          };
        });
        setFriends(parsed);
        setFriendCount(friendsRes.count ?? targetFriendIds.length);
        if (needFriends)
          memSet(friendsKey, {
            friends: parsed,
            count: friendsRes.count ?? targetFriendIds.length,
          });
      } else if (cachedFriends) {
        const safeFriends = Array.isArray(cachedFriends.friends)
          ? cachedFriends.friends.filter((friend) => friend && typeof friend.id === "string")
          : [];
        setFriends(safeFriends);
        setFriendCount(
          Number.isFinite(cachedFriends.count) ? cachedFriends.count : safeFriends.length,
        );
      }

      setPostCount(postsCountRes.count ?? 0);
      setFollowingCount(followingCountRes.count ?? 0);
      setFollowerCount(followerCountRes.count ?? 0);
      if (friendsRes.count == null && cachedFriends) {
        setFriendCount(cachedFriends.count);
      }
      setActivity(
        (activityRes.data ?? []).map((post) => {
          const postKind =
            `${String(post.type ?? "")} ${String(post.media_type ?? "")}`.toLowerCase();
          const isVideo = postKind.includes("video") || postKind.includes("reel");
          return {
            id: post.id,
            icon: isVideo ? Play : ImageIcon,
            title: String(post.content ?? "").trim()
              ? `Posted: ${String(post.content).trim().slice(0, 64)}`
              : isVideo
                ? "Shared a new video"
                : "Published a new post",
            detail: post.created_at
              ? new Date(post.created_at).toLocaleDateString()
              : "",
            to: `/post/${encodeURIComponent(post.id)}`,
            tone: isVideo ? "blue" : "mint",
          };
        }),
      );

      const blockData = blockRes.data as { blocked_id: string } | null;
      setIsBlocked(!!blockData);

      const statusData = statusRes.data as {
        id?: string | null;
        status: "none" | "pending" | "accepted";
      } | null;
      if (statusData) {
        setFriendStatus(statusData.status);
        setFriendshipId(statusData.id || null);
      } else {
        setFriendStatus("none");
        setFriendshipId(null);
      }

      setLoading(false);
    };

    run().catch((err) => {
      console.error("[UserProfilePreviewModal] load failed:", err);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [userId, currentUserId, isOwnProfile]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleAddFriend = useCallback(async () => {
    if (!userId || !currentUserId || friendStatus !== "none" || actionBusy) return;
    setActionBusy(true);
    try {
      const { error } = await supabase
        .from("friendships")
        .insert({
          sender_id: currentUserId,
          receiver_id: userId,
          status: "pending",
        })
        .select("id")
        .maybeSingle();
      if (error) throw error;
      setFriendStatus("pending");
      toast.success("Friend request sent");
    } catch (error) {
      console.error("[UserProfilePreviewModal] friend request failed:", error);
      toast.error("Could not send request");
    } finally {
      setActionBusy(false);
    }
  }, [friendStatus, actionBusy, currentUserId, userId]);

  const handleUnfriend = useCallback(async () => {
    if (!userId || !currentUserId || friendStatus !== "accepted" || actionBusy) return;
    if (!window.confirm("Unfriend this person?")) return;
    setActionBusy(true);
    try {
      const { error } = friendshipId
        ? await supabase.from("friendships").delete().eq("id", friendshipId)
        : await supabase
            .from("friendships")
            .delete()
            .or(
              `and(sender_id.eq.${currentUserId},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUserId})`
            );
      if (error) throw error;
      setFriendStatus("none");
      setFriendshipId(null);
      setFriendCount((count) => Math.max(0, count - 1));
      toast.success("Unfriended");
    } catch (error) {
      console.error("[UserProfilePreviewModal] unfriend failed:", error);
      toast.error("Could not unfriend this user");
    } finally {
      setActionBusy(false);
    }
  }, [friendStatus, actionBusy, friendshipId, currentUserId, userId]);

  const handleMessage = useCallback(() => {
    if (isBlocked) {
      toast.error("Unblock this user to message them");
      return;
    }
    if (
      profile?.is_private_mode &&
      friendStatus !== "accepted" &&
      !isOwnProfile
    ) {
      toast.error("This user has enabled Private Mode.");
      return;
    }
    if (!profile) return;
    window.dispatchEvent(
      new CustomEvent("flicks:open-chat", {
        detail: {
          userId: profile.id,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
        },
      })
    );
    onClose();
  }, [isBlocked, profile, friendStatus, isOwnProfile, onClose]);

  const handleToggleBlock = useCallback(async () => {
    if (!userId || !currentUserId || actionBusy) return;
    if (
      !isBlocked &&
      !window.confirm(
        "Block this user? You will no longer see each other's content."
      )
    ) {
      return;
    }
    setActionBusy(true);
    try {
      if (isBlocked) {
        const { error } = await supabase
          .from("user_blocks")
          .delete()
          .eq("blocker_id", currentUserId)
          .eq("blocked_id", userId);
        if (error) throw error;
        setIsBlocked(false);
        setMenuOpen(false);
        toast.success("Unblocked");
      } else {
        const { error } = await supabase
          .from("user_blocks")
          .insert({ blocker_id: currentUserId, blocked_id: userId });
        if (error && !error.message?.toLowerCase().includes("duplicate")) {
          throw error;
        }
        const { error: friendshipError } = await supabase
          .from("friendships")
          .delete()
          .or(
            `and(sender_id.eq.${currentUserId},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUserId})`
          );
        if (friendshipError) {
          console.error(
            "[UserProfilePreviewModal] friendship cleanup after block failed:",
            friendshipError,
          );
        }
        setFriendStatus("none");
        setFriendshipId(null);
        setIsBlocked(true);
        setMenuOpen(false);
        toast.success("User blocked");
        onClose();
      }
    } catch (error) {
      console.error("[UserProfilePreviewModal] block action failed:", error);
      toast.error(isBlocked ? "Could not unblock" : "Could not block");
    } finally {
      setActionBusy(false);
    }
  }, [actionBusy, isBlocked, currentUserId, userId, onClose]);

  const handleViewProfile = useCallback(() => {
    if (!userId) return;
    onClose();
    navigateRef.current(`/profile/${userId}`);
  }, [onClose, userId]);

  const handleReport = useCallback(() => {
    if (!currentUserId) {
      toast.error("Please sign in to report this user.");
      return;
    }
    if (isOwnProfile) return;
    setReportReason("");
    setReportOpen(true);
  }, [currentUserId, isOwnProfile]);

  const handleSubmitReport = useCallback(async () => {
    const reason = reportReason.trim();
    if (!currentUserId || !userId || !reason || reportSubmitting) return;
    setReportSubmitting(true);
    try {
      const { error } = await supabase.from("reports").insert({
        reporter_id: currentUserId,
        target_id: userId,
        reason,
      });
      if (error) throw error;
      setReportOpen(false);
      setReportReason("");
      toast.success("Report submitted. Admin team will review it.");
    } catch (error) {
      console.error("[UserProfilePreviewModal] report failed:", error);
      toast.error("Could not submit report");
    } finally {
      setReportSubmitting(false);
    }
  }, [currentUserId, reportReason, reportSubmitting, userId]);

  const handleViewFullProfile = useCallback(() => {
    if (!userId) return;
    onClose();
    navigateRef.current(`/profile/${userId}`);
  }, [onClose, userId]);

  const menuItems = () => {
    if (isBlocked) {
      return [{ label: "Unblock User", icon: Shield, action: handleToggleBlock }];
    }
    const items: Array<{
      label: string;
      icon: React.ElementType;
      action: () => void;
      danger?: boolean;
    }> = [];
    if (isPublic) {
      items.push({
        label: "View Profile",
        icon: UserRound,
        action: handleViewProfile,
      });
    }
    if (friendStatus === "accepted") {
      items.push(
        { label: "Direct Chat", icon: MessageCircle, action: handleMessage },
        { label: "Unfriend", icon: UserRound, action: handleUnfriend, danger: true },
        { label: "Block User", icon: Shield, action: handleToggleBlock, danger: true },
        { label: "Report", icon: Flag, action: handleReport, danger: true }
      );
    } else {
      items.push(
        { label: "Add Friend", icon: UserRoundPlus, action: handleAddFriend },
        { label: "Block User", icon: Shield, action: handleToggleBlock, danger: true },
        { label: "Report", icon: Flag, action: handleReport, danger: true }
      );
    }
    return items;
  };



  if (!userId) return null;

  if (loading) {
    return createPortal(
      <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <div
          role="status"
          aria-label="Loading profile"
          className="w-full max-w-sm animate-pulse overflow-hidden rounded-2xl bg-white p-6 shadow-2xl"
        >
          <div className="mx-auto h-20 w-20 rounded-full bg-slate-200" />
          <div className="mx-auto mt-4 h-4 w-36 rounded bg-slate-200" />
          <div className="mx-auto mt-3 h-3 w-24 rounded bg-slate-100" />
          <div className="mt-6 h-16 rounded-xl bg-slate-100" />
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="h-12 rounded-lg bg-slate-100" />
            <div className="h-12 rounded-lg bg-slate-100" />
            <div className="h-12 rounded-lg bg-slate-100" />
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  if (!profile) return null;

  const profession =
    (profile?.work ||
      profile?.profession ||
      profile?.job_title ||
      profile?.occupation) || "";

  const locationDisplay =
    profile?.location ||
    [profile?.city, profile?.district, profile?.state]
      .filter(Boolean)
      .join(", ") || "";

  const mutualFriends = friends.slice(0, 4);
  const toggleMenu = () => {
    if (!menuOpen && menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: Math.min(rect.bottom + 8, Math.max(8, window.innerHeight - 280)),
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
    setMenuOpen((open) => !open);
  };

  return createPortal(
    <>
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${profile.full_name || "User"} profile preview`}
          className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="relative h-28 bg-gradient-to-br from-[#dff4ef] via-[#dcefed] to-[#f7e8e1]">
            <div className="absolute right-3 top-3 z-40 mr-2 flex items-center gap-2">
              {!isOwnProfile && (
                <button
                  type="button"
                  aria-label={
                    friendStatus === "accepted"
                      ? "Message"
                      : friendStatus === "pending"
                        ? "Friend request pending"
                        : "Add friend"
                  }
                  disabled={actionBusy || friendStatus === "pending"}
                  onClick={
                    friendStatus === "accepted"
                      ? handleMessage
                      : handleAddFriend
                  }
                  className="pointer-events-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/80 bg-[#149da6] text-white shadow-md transition hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {friendStatus === "accepted" ? (
                    <MessageCircle size={16} />
                  ) : (
                    <UserRoundPlus size={17} />
                  )}
                </button>
              )}
              <button
                ref={menuButtonRef}
                type="button"
                aria-label="Open profile actions"
                aria-expanded={menuOpen}
                onClick={toggleMenu}
                className="pointer-events-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/80 bg-white text-[color:#108f90] shadow-md transition hover:bg-[#f2f7f6]"
              >
                <MoreVertical size={19} />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close profile preview"
                className="pointer-events-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/80 bg-white text-[color:#263a40] shadow-md transition hover:bg-[#f2f7f6]"
              >
                <X size={17} />
              </button>
            </div>
          </div>
          <div className="relative -mt-20 px-5 pb-3">
            <div className="relative z-20 mx-auto h-24 w-24 rounded-full border-4 border-white bg-[color:#f2e6de] shadow-lg">
              <img
                src={
                  profile.avatar_url ||
                  "https://images.unsplash.com/photo-1476794233478-6e539e824b8e?auto=format&fit=crop&w=400&q=85"
                }
                alt={profile.full_name ?? "Profile"}
                className="h-full w-full rounded-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>

          </div>

          <div className="px-6 pt-1 pb-1 text-center">
            <h1 className="truncate text-[20px] font-black text-[color:#263a40] tracking-tight leading-tight">
              {profile.full_name ?? "Flicks member"}
            </h1>
            {profile.username && (
              <p className="mt-1 text-[11px] font-medium text-[color:#849397]">
                @{profile.username}
                {locationDisplay && ` · ${locationDisplay}`}
              </p>
            )}
            {!profile.username && (
              <p className="mt-1 text-[11px] font-medium text-[color:#849397]">
                {"Flicks member"}
              </p>
            )}
            <div className="mt-4 flex items-center justify-center gap-2 text-[12px] font-semibold text-[color:#849397]">
              <Clock3 size={13} className="text-[color:#169c9a]" />
              <span>{formatLastSeen(profile.last_seen)}</span>
            </div>
            <div className="mt-1 flex items-center justify-center gap-2 text-[11px] text-[color:#849397]">
              <UsersRound size={12} className="text-[color:#169c9a]" />
              <span>{friendCount} friends</span>
            </div>
          </div>

          {profile.bio && (
            <p className="px-6 pt-3 text-center text-[12px] leading-relaxed text-[color:#facc15]">
              {profile.bio}
            </p>
          )}
          {!isOwnProfile && (
            <div className="px-5 pt-4 pb-3">
              <button
                type="button"
                onClick={handleMessage}
                aria-label={`Start a chat with ${profile.full_name || "this user"}`}
                className="group relative flex min-h-[104px] w-full cursor-pointer items-center overflow-hidden rounded-2xl border border-white/10 bg-[#11152c] text-left shadow-[0_12px_30px_rgba(16,24,48,0.28)] transition duration-300 hover:-translate-y-0.5 hover:border-emerald-300/30 hover:shadow-[0_16px_36px_rgba(32,65,112,0.36)] active:translate-y-0"
                style={{
                  backgroundImage:
                    "radial-gradient(ellipse at 18% 110%, rgba(34,197,94,.36), transparent 46%), radial-gradient(ellipse at 72% -10%, rgba(139,92,246,.34), transparent 48%), radial-gradient(ellipse at 100% 100%, rgba(59,130,246,.32), transparent 52%), linear-gradient(112deg, #10251f 0%, #171a36 52%, #101a35 100%)",
                }}
              >
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 h-full w-[48%] object-cover object-center opacity-90 transition duration-500 group-hover:scale-[1.04] group-hover:opacity-100"
                    style={{
                      maskImage:
                        "linear-gradient(to right, black 45%, rgba(0,0,0,.78) 68%, transparent 100%)",
                      WebkitMaskImage:
                        "linear-gradient(to right, black 45%, rgba(0,0,0,.78) 68%, transparent 100%)",
                    }}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 flex w-[42%] items-center justify-center bg-gradient-to-br from-emerald-300/30 via-violet-400/25 to-blue-400/30 text-3xl font-bold text-white/80"
                    style={{
                      maskImage:
                        "linear-gradient(to right, black 45%, rgba(0,0,0,.78) 68%, transparent 100%)",
                      WebkitMaskImage:
                        "linear-gradient(to right, black 45%, rgba(0,0,0,.78) 68%, transparent 100%)",
                    }}
                  >
                    {(profile.full_name || "U").trim().charAt(0).toUpperCase()}
                  </div>
                )}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-r from-emerald-950/10 via-indigo-950/10 to-blue-950/20"
                />
                <span className="relative z-10 ml-[39%] flex min-w-0 flex-1 items-center gap-2 px-4 py-5 text-white">
                  <motion.span
                    className="block truncate text-[22px] leading-none text-white/95 sm:text-[24px]"
                    style={{ fontFamily: "'Caveat', 'Comic Sans MS', cursive" }}
                    animate={{ opacity: [0.72, 1, 0.72] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    Write something to chat...
                  </motion.span>
                  <span className="shrink-0 text-xl" role="img" aria-label="writing">
                    ✍️
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-3 right-4 h-px w-14 bg-gradient-to-r from-transparent via-emerald-200/50 to-transparent"
                />
              </button>
            </div>
          )}
          <div className="bg-[color:#0a0a0a] grid grid-cols-4 px-6 py-3">
            <div className="flex flex-col items-center gap-1.5 border-l border-0 border-l-[color:#222] first:border-l-0 rounded-md bg-[color:#111]">
              <span className="text-[15px] font-black text-[color:#facc15]">
                {postCount}
              </span>
              <span className="text-[10px] font-medium text-[color:#facc15]">
                Posts
              </span>
            </div>
            <div className="flex flex-col items-center gap-1.5 border-l border-[color:#edf1f0]">
              <span className="text-[15px] font-black text-[color:#facc15]">
                {friendCount}
              </span>
              <span className="text-[10px] font-medium text-[color:#facc15]">
                Friends
              </span>
            </div>
            <div className="flex flex-col items-center gap-1.5 border-l border-[color:#edf1f0]">
              <span className="text-[15px] font-black text-[color:#facc15]">
                {followingCount}
              </span>
              <span className="text-[10px] font-medium text-[color:#facc15]">
                Following
              </span>
            </div>
            <div className="flex flex-col items-center gap-1.5 border-l border-[color:#edf1f0]">
              <span className="text-[15px] font-black text-[color:#facc15]">
                {followerCount}
              </span>
              <span className="text-[10px] font-medium text-[color:#facc15]">
                Followers
              </span>
            </div>
          </div>

          <section className="px-6 pt-4 pb-2" aria-labelledby="ppm-mutual-title">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h2 id="ppm-mutual-title" className="text-[13px] font-black text-[color:#37494c]">
                  Friends in common
                </h2>
                <p className="mt-0.5 text-[10px] text-[color:#9aa6a7]">
                  You and {profile.full_name} share{" "}
                  <strong className="text-[color:#6f8586]">{friends.length} friends</strong>
                </p>
              </div>
              <button
                type="button"
                className="text-[10px] font-bold text-[color:#0d9695] hover:underline"
                onClick={() => {
                  if (!userId) return;
                  setMenuOpen(false);
                  navigateRef.current(`/profile/${userId}`);
                }}
              >
                + More
              </button>
            </div>
            <div className="flex items-center mt-2">
              {mutualFriends.map((f) => (
                <button
                  type="button"
                  key={f.id}
                  onClick={() => {
                    if (!f?.id) return;
                    onClose();
                    setTimeout(() => navigateRef.current(`/profile/${f.id}`), 150);
                  }}
                  className="h-8 w-8 shrink-0 rounded-full border-2 border-white bg-[color:#e8f1f0] overflow-hidden"
                >
                  {f.avatar_url ? (
                    <img
                      src={f.avatar_url}
                      alt={f.full_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[8px] font-black text-[color:#526264]">
                      {(f.full_name || "?")[0].toUpperCase()}
                    </span>
                  )}
                </button>
              ))}
              {friends.length > 4 && (
                <button
                  type="button"
                  onClick={() => {
                    if (!userId) return;
                    setMenuOpen(false);
                    navigateRef.current(`/profile/${userId}`);
                  }}
                  className="ml-1 flex h-8 min-w-8 items-center justify-center rounded-full border-2 border-white bg-[color:#e8f1f0] px-1 text-[9px] font-black text-[color:#668184]"
                >
                  +{friends.length - 4}
                </button>
              )}
              <span className="ml-3 text-[10px] text-[color:#899697]">
                {friends.length > 0
                  ? mutualFriends.map((friend) => friend.full_name).join(", ")
                  : "No mutual friends yet"}
              </span>
            </div>
          </section>
          <section className="px-6 pt-4 border-t border-[color:#f0f3f2]" aria-labelledby="ppm-about-title">
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[color:#e8f6f3] text-[color:#0c9291]">
                <UserRound size={15} />
              </span>
              <h2 id="ppm-about-title" className="text-[13px] font-black text-[color:#37494c]">
                About Me
              </h2>
            </div>
            <div className="space-y-px">
              {profession && (
                <button type="button" className="w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-[color:#b4c1c0] transition hover:bg-[#f6faf9]">
                  <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-[color:#f4edf5] text-[color:#a27da6]">
                    <BriefcaseBusiness size={15} />
                  </span>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <strong className="text-[10px] font-black text-[color:#586669] truncate">
                      {profession}
                    </strong>
                  </div>
                  <ChevronRight size={14} className="text-[color:#b3bfbd]" />
                </button>
              )}
              {profile.school && (
                <button type="button" className="w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-[color:#b4c1c0] transition hover:bg-[#f6faf9]">
                  <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-[color:#fbf3e3] text-[color:#d29d52]">
                    <GraduationCap size={15} />
                  </span>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <strong className="text-[10px] font-black text-[color:#586669] truncate">
                      {profile.school}
                    </strong>
                    <small className="text-[9px] text-[color:#a0aaaa]">Studied</small>
                  </div>
                  <ChevronRight size={14} className="text-[color:#b3bfbd]" />
                </button>
              )}
              {locationDisplay && (
                <button type="button" className="w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-[color:#b4c1c0] transition hover:bg-[#f6faf9]">
                  <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-[color:#eaf6f3] text-[color:#69aaa6]">
                    <Home size={15} />
                  </span>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <strong className="text-[10px] font-black text-[color:#586669] truncate">
                      Lives in {locationDisplay}
                    </strong>
                    <small className="text-[9px] text-[color:#a0aaaa]">Current city</small>
                  </div>
                  <ChevronRight size={14} className="text-[color:#b3bfbd]" />
                </button>
              )}
              {profile.state && (
                <button type="button" className="w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-[color:#b4c1c0] transition hover:bg-[#f6faf9]">
                  <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-[color:#f0eef9] text-[color:#8c89b2]">
                    <MapPin size={15} />
                  </span>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <strong className="text-[10px] font-black text-[color:#586669] truncate">
                      From {profile.state}
                    </strong>
                    <small className="text-[9px] text-[color:#a0aaaa]">Hometown</small>
                  </div>
                  <ChevronRight size={14} className="text-[color:#b3bfbd]" />
                </button>
              )}
            </div>
          </section>
          <section className="px-6 pt-4 border-t border-[color:#f0f3f2]" aria-labelledby="ppm-activity-title">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 id="ppm-activity-title" className="text-[13px] font-black text-[color:#37494c]">
                  Last Activity
                </h2>
                <p className="mt-0.5 text-[10px] text-[color:#9aa6a7]">
                  Recent actions from {profile.full_name}’s world
                </p>
              </div>
              <button
                type="button"
                className="text-[10px] font-bold text-[color:#0d9695] hover:underline"
                onClick={() => {
                  if (!userId) return;
                  setMenuOpen(false);
                  navigateRef.current(`/profile/${userId}`);
                }}
              >
                See all
              </button>
            </div>
            <div className="space-y-px">
              {activity.length === 0 ? (
                <p className="py-4 text-center text-[11px] text-[color:#8d9a9b]">
                  No recent public activity yet.
                </p>
              ) : activity.map((item) => {
                const color = ACTIVITY_COLORS[item.tone];
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      setMenuOpen(false);
                      navigateRef.current(item.to);
                    }}
                    className="w-full grid grid-cols-[34px_minmax(0,1fr)_auto_15px] items-center gap-2.5 rounded-md px-3 py-2 text-left text-[color:#536468] transition hover:bg-[#f7fbfa] active:scale-[0.98]"
                  >
                    <span className={`flex h-6 w-6 items-center justify-center rounded-sm ${color.bg} text-[color:${color.color}]`}>
                      <item.icon size={15} />
                    </span>
                    <span className="flex-1 min-w-0 flex flex-col">
                      <strong className="text-[10px] font-black text-[color:#536265] truncate">
                        {item.title}
                      </strong>
                      {item.detail && (
                        <small className="text-[9px] text-[color:#9ba7a7] truncate">
                          {item.detail}
                        </small>
                      )}
                    </span>
                    <span className="text-[9px] text-[color:#ff0000]">Tap</span>
                    <ChevronRight size={13} className="text-[color:#b3bfbd] shrink-0" />
                  </button>
                );
              })}
            </div>
          </section>

          <footer className="border-t border-[color:#eff3f2] px-6 py-2 text-center">
            <p className="text-[9px] text-[color:#ff0000]">
              A closer look at your Flicks community{" "}
              <span className="mx-1 text-[color:#c4cecc]">·</span>
              <b className="text-[color:#79a7a3] font-bold">flicks india</b>
            </p>
          </footer>
        </div>
      </motion.div>
    </AnimatePresence>
    {menuOpen &&
      createPortal(
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, y: -6, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.95 }}
          transition={{ duration: 0.12 }}
          role="menu"
          style={{ top: menuPosition.top, right: menuPosition.right }}
          className="fixed right-0 z-[9050] w-56 max-w-[calc(100vw-1rem)] origin-top-right rounded-xl border border-[color:#e6eeed] bg-white shadow-[0_13px_34px_rgba(32,73,77,0.18)]"
        >
          <div className="px-3 py-2 text-[9px] font-black uppercase tracking-wider text-[color:#9ba8a8]">
            {isBlocked ? "Blocked profile" : "Profile options"}
          </div>
          {menuItems().map(({ label, icon: Icon, action, danger }) => (
            <button
              type="button"
              key={label}
              role="menuitem"
                  disabled={actionBusy}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setMenuOpen(false);
                    action();
                  }}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-left text-[12px] font-semibold transition-colors duration-150 hover:bg-[#eef8f6] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${
                danger
                  ? "text-[color:#b76a68] hover:bg-[#fff1ef]"
                  : "text-[color:#536468] hover:bg-[#eef8f6] hover:text-[color:#087d81]"
              } ${
                label === "View Full Profile"
                  ? "mt-2 border border-[color:#d3efea] bg-[#eaf8f5] font-black text-[color:#087d81]"
                  : ""
              }`}
            >
              <Icon size={16} />
              <span>{label}</span>
              {label === "View Full Profile" && (
                <ChevronRight size={14} className="ml-auto" />
              )}
            </button>
          ))}
        </motion.div>,
        document.body,
      )}
    {reportOpen &&
      createPortal(
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          onClick={() => !reportSubmitting && setReportOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ppm-report-title"
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#151322] p-5 text-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300">
                  <Flag size={17} />
                </span>
                <div>
                  <h2 id="ppm-report-title" className="text-sm font-bold">
                    Report user
                  </h2>
                  <p className="text-xs text-white/55">Our team will review it</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close report dialog"
                disabled={reportSubmitting}
                onClick={() => setReportOpen(false)}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {[
                "Spam or scam",
                "Harassment or bullying",
                "Hate speech",
                "Inappropriate content",
                "Fake account",
                "Other",
              ].map((reason) => (
                <button
                  type="button"
                  key={reason}
                  onClick={() => setReportReason(reason)}
                  className={`cursor-pointer rounded-xl border px-2 py-2 text-[11px] font-semibold transition-colors ${
                    reportReason === reason
                      ? "border-rose-300/50 bg-rose-500/20 text-rose-100"
                      : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10"
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
            <textarea
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value)}
              placeholder="Choose a reason or add details..."
              rows={3}
              className="mb-4 w-full resize-none rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-rose-300/50"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={reportSubmitting}
                onClick={() => setReportOpen(false)}
                className="flex-1 cursor-pointer rounded-xl bg-white/10 py-2.5 text-sm font-semibold text-white/75 transition-colors hover:bg-white/15 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reportSubmitting || !reportReason.trim()}
                onClick={handleSubmitReport}
                className="flex-1 cursor-pointer rounded-xl bg-gradient-to-r from-rose-500 to-red-600 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {reportSubmitting ? "Submitting..." : "Submit report"}
              </button>
            </div>
          </motion.div>
        </motion.div>,
        document.body,
      )}
    </>,
    document.body
  );
};

const UserProfilePreviewModal = (props: Props) => {
  const isInsideRouter = useInRouterContext();
  if (!isInsideRouter) return null;
  return <UserProfilePreviewModalContent {...props} />;
};

export default UserProfilePreviewModal;
