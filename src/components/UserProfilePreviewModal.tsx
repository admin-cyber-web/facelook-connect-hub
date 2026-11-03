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
    const { error } = await supabase
      .from("friendships")
      .insert({
        sender_id: currentUserId,
        receiver_id: userId,
        status: "pending",
      })
      .select("id")
      .maybeSingle();
    setActionBusy(false);
    if (error) {
      toast.error("Could not send request");
      return;
    }
    setFriendStatus("pending");
    toast.success("Friend request sent");
  }, [friendStatus, actionBusy, currentUserId, userId]);

  const handleUnfriend = useCallback(async () => {
    if (!userId || !currentUserId || friendStatus !== "accepted" || actionBusy) return;
    if (!window.confirm("Unfriend this person?")) return;
    setActionBusy(true);
    if (friendshipId) {
      await supabase.from("friendships").delete().eq("id", friendshipId);
    } else {
      await supabase
        .from("friendships")
        .delete()
        .or(
          `and(sender_id.eq.${currentUserId},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUserId})`
        );
    }
    setActionBusy(false);
    setFriendStatus("none");
    setFriendshipId(null);
    setFriendCount((c) => Math.max(0, c - 1));
    setMenuOpen(false);
    toast.success("Unfriended");
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
    setActionBusy(true);
    if (isBlocked) {
      const { error } = await supabase
        .from("user_blocks")
        .delete()
        .eq("blocker_id", currentUserId)
        .eq("blocked_id", userId);
      setActionBusy(false);
      if (error) {
        toast.error("Could not unblock");
        return;
      }
      setIsBlocked(false);
      setMenuOpen(false);
      toast.success("Unblocked");
    } else {
      if (
        !window.confirm(
          "Block this user? You will no longer see each other's content."
        )
      ) {
        setActionBusy(false);
        return;
      }
      const { error } = await supabase
        .from("user_blocks")
        .insert({ blocker_id: currentUserId, blocked_id: userId });
      if (!error) {
        await supabase
          .from("friendships")
          .delete()
          .or(
            `and(sender_id.eq.${currentUserId},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUserId})`
          );
        setFriendStatus("none");
        setFriendshipId(null);
      }
      setActionBusy(false);
      if (error && !error.message?.toLowerCase().includes("duplicate")) {
        toast.error("Could not block");
        return;
      }
      setIsBlocked(true);
      setMenuOpen(false);
      toast.success("User blocked");
    }
  }, [actionBusy, isBlocked, currentUserId, userId]);

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
        label: "View Full Profile",
        icon: UserRound,
        action: handleViewFullProfile,
      });
    }
    if (friendStatus === "accepted") {
      items.push(
        { label: "Direct Chat", icon: MessageCircle, action: handleMessage },
        { label: "Unfriend", icon: UserRound, action: handleUnfriend, danger: true },
        { label: "Block User", icon: Shield, action: handleToggleBlock, danger: true }
      );
    } else {
      items.push(
        { label: "Add Friend", icon: UserRoundPlus, action: handleAddFriend },
        { label: "Block User", icon: Shield, action: handleToggleBlock, danger: true }
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
            <div className="px-6 pt-3 text-center">
              <p className="text-[12px] leading-relaxed text-[color:#69777a]">
                {profile.bio}
              </p>
              <button
                type="button"
                onClick={handleMessage}
                className="mt-4 inline-flex items-center justify-center gap-2 min-w-[142px] h-9 border border-[color:#e4e8e8] rounded-[9px] bg-[color:#f0f2f2] px-3 text-[11px] font-bold text-[color:#687477] transition hover:bg-[color:#12999a] hover:text-white active:scale-95"
              >
                <MessageCircle size={14} />
                Send Message
              </button>
            </div>
          )}
          <div className="border-y border-[color:#edf1f0] grid grid-cols-4 px-6 py-3">
            <div className="flex flex-col items-center gap-1.5 border-l border-[color:#edf1f0] first:border-l-0">
              <span className="text-[15px] font-black text-[color:#42565a]">
                {postCount}
              </span>
              <span className="text-[10px] font-medium text-[color:#9aa5a6]">
                Posts
              </span>
            </div>
            <div className="flex flex-col items-center gap-1.5 border-l border-[color:#edf1f0]">
              <span className="text-[15px] font-black text-[color:#42565a]">
                {friendCount}
              </span>
              <span className="text-[10px] font-medium text-[color:#9aa5a6]">
                Friends
              </span>
            </div>
            <div className="flex flex-col items-center gap-1.5 border-l border-[color:#edf1f0]">
              <span className="text-[15px] font-black text-[color:#42565a]">
                {followingCount}
              </span>
              <span className="text-[10px] font-medium text-[color:#9aa5a6]">
                Following
              </span>
            </div>
            <div className="flex flex-col items-center gap-1.5 border-l border-[color:#edf1f0]">
              <span className="text-[15px] font-black text-[color:#42565a]">
                {followerCount}
              </span>
              <span className="text-[10px] font-medium text-[color:#9aa5a6]">
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
                    <span className="text-[9px] text-[color:#aab4b3]">Tap</span>
                    <ChevronRight size={13} className="text-[color:#b3bfbd] shrink-0" />
                  </button>
                );
              })}
            </div>
          </section>

          <footer className="border-t border-[color:#eff3f2] px-6 py-2 text-center">
            <p className="text-[9px] text-[color:#a6b0af]">
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
              onClick={() => {
                action();
                setMenuOpen(false);
              }}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-left text-[12px] font-semibold transition ${
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
