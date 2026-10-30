import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import {
  X,
  MoreHorizontal,
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
  Heart,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  userId: string;
  currentUserId: string;
  onClose: () => void;
  isAdmin?: boolean;
}

interface ProfileData {
  id: string;
  full_name: string;
  username?: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
  city?: string;
  state?: string;
  district?: string;
  school?: string;
  work?: string;
  profession?: string;
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

const mockActivity: ActivityItem[] = [
  {
    id: "act-1",
    icon: Heart,
    title: 'Liked the post: “The long way home”',
    detail: "",
    to: "/post/post-liked-001",
    tone: "pink",
  },
  {
    id: "act-2",
    icon: Play,
    title: 'Posted a new Flick: “Sunday market moments”',
    detail: "",
    to: "/post/post-flick-002",
    tone: "blue",
  },
  {
    id: "act-3",
    icon: MessageCircle,
    title: "Commented on: “Great capture!”",
    detail: "in Weekend vibes",
    to: "/post/post-comment-003",
    tone: "mint",
  },
  {
    id: "act-4",
    icon: UsersRound,
    title: 'Joined Circle: “Photography Lovers”',
    detail: "",
    to: "/circle/circle-joined-004",
    tone: "lilac",
  },
];

const TEAL = "#169c9a";
const DEEP_TEAL = "#087d81";

const formatLastSeen = (iso?: string | null): string => {
  if (!iso) return "Last Seen : --";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "Last Seen : --";
    const day = d.toLocaleDateString(undefined, { weekday: "short" } as any);
    const time = d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    } as any);
    return `Last Seen : ${day} ${time}`;
  } catch {
    return "Last Seen : --";
  }
};

const UserProfilePreviewModal = ({
  userId,
  currentUserId,
  onClose,
  isAdmin: isAdminProp = false,
}: Props) => {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [postCount, setPostCount] = useState(0);
  const [friendCount, setFriendCount] = useState(0);
  const [friendStatus, setFriendStatus] = useState<
    "none" | "pending" | "accepted"
  >("none");
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  const isOwnProfile = userId === currentUserId;
  const isLocked = !!profile?.profile_locked || !!profile?.is_private_mode;
  const isPublic = !isLocked;

  // ── Data loading ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    let active = true;
    setLoading(true);

    const run = async () => {
      const profileKey = `ppm:profile:${userId}`;
      const friendsKey = `ppm:friends:${userId}`;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { memGet, memSet } = await import("../lib/memCache");

      const cachedProfile = memGet<ProfileData>(profileKey);
      const cachedFriends = memGet<{ friends: Friend[]; count: number }>(
        friendsKey
      );

      const needProfile = !cachedProfile;
      const needFriends = !cachedFriends;

      const [profileRes, friendsRes, blockRes, statusRes] =
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
                .select("id, sender_id, receiver_id")
                .eq("status", "accepted")
                .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
                .limit(30)
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
        ]);

      if (!active) return;

      if (profileRes.data) {
        setProfile(profileRes.data as ProfileData);
        if (needProfile) memSet(profileKey, profileRes.data);
      }

      if (friendsRes.data) {
        const rows = friendsRes.data as Array<{
          id: string;
          sender_id: string;
          receiver_id: string;
        }>;
        const parsed: Friend[] = rows
          .map((row) => {
            const friendId =
              row.sender_id === userId ? row.receiver_id : row.sender_id;
            return {
              id: friendId,
              full_name: "Flicks member",
              avatar_url: undefined,
              friendshipId: row.id,
            };
          })
          .filter((f) => f.id !== currentUserId);
        setFriends(parsed);
        setFriendCount(parsed.length);
        if (needFriends)
          memSet(friendsKey, { friends: parsed, count: parsed.length });
      } else if (cachedFriends) {
        setFriends(cachedFriends.friends);
        setFriendCount(cachedFriends.count);
      }

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
    if (friendStatus !== "none" || actionBusy) return;
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
    if (friendStatus !== "accepted" || actionBusy) return;
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
    if (actionBusy) return;
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



  if (loading) {
    return null;
  }

  if (!profile) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={onClose}
        />
      </AnimatePresence>
    );
  }

  const profession =
    (profile?.work ||
      profile?.profession ||
      (profile as any)?.job_title ||
      (profile as any)?.occupation) || "";

  const locationDisplay =
    profile?.location ||
    [profile?.city, profile?.district, profile?.state]
      .filter(Boolean)
      .join(", ") || "";

  const mutualFriends = friends.slice(0, 4);

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile preview"
            className="absolute left-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-[color:#d8e2e0] bg-white text-[color:#263a40] transition hover:bg-[#f2f7f6]"
          >
            <X size={17} />
          </button>
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

            <div className="absolute z-20 top-[-5px] left-3 right-3 flex justify-between px-1 pointer-events-none">
              <button
                type="button"
                aria-label={
                  friendStatus === "accepted" ? "Message" : "Add friend"
                }
                onClick={
                  friendStatus === "accepted"
                    ? handleMessage
                    : () => {
                        setMenuOpen(false);
                        handleAddFriend();
                      }
                }
                className="relative pointer-events-auto z-10 h-10 w-10 rounded-full border-2 border-white bg-[color:#149da6] shadow-md flex items-center justify-center transition hover:scale-105 active:scale-95"
              >
                {friendStatus === "accepted" ? (
                  <MessageCircle size={17} className="text-white" />
                ) : (
                  <UserRoundPlus size={18} className="text-white" />
                )}
              </button>
              <button
                type="button"
                aria-label="Open full profile"
                onClick={handleViewFullProfile}
                className="relative pointer-events-auto z-10 h-10 w-10 rounded-full border-2 border-white bg-[color:#2aaf76] shadow-md flex items-center justify-center transition hover:scale-105 active:scale-95"
              >
                <UserRound size={17} className="text-white" />
              </button>
            </div>
          </div>

          <div className="px-6 pt-1 pb-1 text-center">
            <h1 className="text-[20px] font-black text-[color:#263a40] tracking-tight leading-tight">
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
              <span>{friendCount} profile views</span>
            </div>
          </div>
          <div className="px-6 pt-2">
            <div className="relative inline-block">
              <button
                type="button"
                className="h-9 w-9 rounded-lg border border-[color:#e3eae9] bg-[color:#eaf7f5] text-[color:#108f90] flex items-center justify-center transition hover:bg-[color:#d8f1ec]"
                aria-label="Open profile actions"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
              >
                <MoreHorizontal size={20} className="text-[color:#108f90]" />
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setMenuOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.95 }}
                    transition={{ duration: 120 }}
                    className="absolute z-30 top-10 right-0 w-56 rounded-xl border border-[color:#e6eeed] bg-white shadow-[0_13px_34px_rgba(32,73,77,0.18)]"
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
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-md text-[12px] font-semibold transition ${
                          danger
                            ? "text-[color:#b76a68] hover:bg-[#fff1ef]"
                            : "text-[color:#536468] hover:bg-[#eef8f6] hover:text-[color:#087d81]"
                        } ${
                          label === "View Full Profile"
                            ? "mt-2 border border-[color:#d3efea] bg-[#eaf8f5] text-[color:#087d81] font-black"
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
                  </motion.div>
                </>
              )}
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
                {friendCount}
              </span>
              <span className="text-[10px] font-medium text-[color:#9aa5a6]">
                Following
              </span>
            </div>
            <div className="flex flex-col items-center gap-1.5 border-l border-[color:#edf1f0]">
              <span className="text-[15px] font-black text-[color:#42565a]">
                {friendCount}
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
                  <strong className="text-[color:#6f8586]">{friendCount} friends</strong>
                </p>
              </div>
              <button
                type="button"
                className="text-[10px] font-bold text-[color:#0d9695] hover:underline"
                onClick={() => {
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
                    setMenuOpen(false);
                    navigateRef.current(`/profile/${userId}`);
                  }}
                  className="ml-1 h-8 w-8 rounded-full border-2 border-white bg-[color:#e8f1f0] flex items-center justify-center text-[8px] font-black text-[color:#668184]"
                >
                  +{friends.length - 4}
                </button>
              )}
              <span className="ml-3 text-[10px] text-[color:#899697]">
                {mutualFriends.map((f) => f.full_name).join(", ")}&hellip;
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
                  setMenuOpen(false);
                  navigateRef.current(`/profile/${userId}`);
                }}
              >
                See all
              </button>
            </div>
            <div className="space-y-px">
              {mockActivity.map((item) => {
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
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default UserProfilePreviewModal;



