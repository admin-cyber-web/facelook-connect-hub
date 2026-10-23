import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { openFilePicker } from "@/lib/nativeFilePicker";
import { canViewPrivateProfile } from "@/lib/profileSearch";
import { toast } from "sonner";
import { sharePost } from "@/lib/sharePost";
import { buildPostShareUrl } from "@/lib/universalShare";
import FriendWall from "@/components/FriendWall";
import {
  FullProfilePage,
  type ProfileNavigationFriend,
  type ProfileNavigationMedia,
  type ProfileNavigationPost,
  type ProfileNavigationProfile,
  type ProfileViewState,
} from "@/components/profile-navigation";

const ChatSystem = lazy(() => import("@/components/ChatSystem"));
const ReelStudio = lazy(() => import("@/components/ReelStudio"));

const MEDIA_PAGE_SIZE = 24;
const MEDIA_POST_FILTER =
  "media_url.not.is.null,image_url.not.is.null,image_urls.not.is.null,cover_url.not.is.null";

interface Props {
  currentUserId: string;
  currentUserEmail?: string;
}

interface FriendshipRow {
  sender_id: string;
  receiver_id: string;
  status: "pending" | "accepted";
}

interface FriendProfileRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  location: string | null;
}

interface MediaPostRow {
  id: string;
  author_id: string;
  content: string | null;
  media_url: string | null;
  image_url: string | null;
  image_urls: string[] | null;
  cover_url: string | null;
  media_type: string | null;
  type: string | null;
  created_at: string;
  likes_count: number | null;
  comments_count: number | null;
  shares_count: number | null;
  views_count: number | null;
  meta_title?: string | null;
  meta_description?: string | null;
}

interface FriendshipStatusRow {
  status: "none" | "pending" | "accepted";
}

const FRIENDSHIP_PAGE_SIZE = 500;
const PROFILE_QUERY_BATCH_SIZE = 200;

async function loadUserFriendships(targetUserId: string, acceptedOnly: boolean) {
  const rows: FriendshipRow[] = [];

  for (let offset = 0; ; offset += FRIENDSHIP_PAGE_SIZE) {
    let query = supabase
      .from("friendships")
      .select("sender_id,receiver_id,status")
      .or(`sender_id.eq.${targetUserId},receiver_id.eq.${targetUserId}`);

    if (acceptedOnly) query = query.eq("status", "accepted");

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + FRIENDSHIP_PAGE_SIZE - 1);

    if (error) return { rows: [], error };

    const page = (data ?? []) as FriendshipRow[];
    rows.push(...page);
    if (page.length < FRIENDSHIP_PAGE_SIZE) break;
  }

  return { rows, error: null };
}

function chunkIds(ids: string[], size: number) {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
}

function toMediaItems(rows: MediaPostRow[]): ProfileNavigationMedia[] {
  const items: ProfileNavigationMedia[] = [];

  for (const row of rows) {
    const sourceType = `${row.media_type || ""} ${row.type || ""}`.toLowerCase();
    const videoUrlPattern = /\.(mp4|m4v|mov|webm)(?:[?#]|$)/i;
    const videoUrl = row.media_url && videoUrlPattern.test(row.media_url)
      ? row.media_url
      : null;
    const isVideo = sourceType.includes("video") || sourceType.includes("reel") || !!videoUrl;

    if (isVideo && row.media_url) {
      items.push({
        id: `${row.id}:video`,
        url: row.media_url,
        preview_url: row.cover_url || row.image_url,
        media_type: "video",
        created_at: row.created_at,
      });
      continue;
    }

    const urls = [
      ...(Array.isArray(row.image_urls) ? row.image_urls : []),
      row.image_url,
      row.media_url,
      row.cover_url,
    ].filter((url): url is string => typeof url === "string" && url.trim().length > 0);
    const uniqueUrls = [...new Set(urls)];

    uniqueUrls.forEach((url, index) => {
      items.push({
        id: `${row.id}:image:${index}`,
        url,
        media_type: "image",
        created_at: row.created_at,
      });
    });
  }

  return items;
}

function isVideoTimelinePost(post: ProfileNavigationPost) {
  const sourceType = `${post.media_type || ""} ${post.type || ""}`.toLowerCase();
  const videoUrl = post.media_url || "";
  return (
    sourceType.includes("video") ||
    sourceType.includes("reel") ||
    sourceType.includes("hook") ||
    sourceType.includes("youtube") ||
    /\.(mp4|m4v|mov|webm)(?:[?#]|$)/i.test(videoUrl) ||
    videoUrl.startsWith("data:video/")
  );
}

function isImageTimelinePost(post: ProfileNavigationPost) {
  const sourceType = `${post.media_type || ""} ${post.type || ""}`.toLowerCase();
  const mediaUrl = post.media_url || "";
  return (
    !isVideoTimelinePost(post) &&
    (Boolean(post.image_url) ||
      Boolean(post.image_urls?.some(Boolean)) ||
      sourceType.includes("image") ||
      sourceType.includes("photo") ||
      /\.(png|jpe?g|gif|webp|avif)(?:[?#]|$)/i.test(mediaUrl))
  );
}

function dispatchOpenChat(profile: ProfileNavigationProfile) {
  window.dispatchEvent(
    new CustomEvent("flicks:open-chat", {
      detail: {
        userId: profile.id,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url || undefined,
      },
    }),
  );
}

export default function ProfileTimelinePage({
  currentUserId,
  currentUserEmail = "",
}: Props) {
  const { userId = "" } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileNavigationProfile | null>(null);
  const [friends, setFriends] = useState<ProfileNavigationFriend[]>([]);
  const [sendingFriendIds, setSendingFriendIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [media, setMedia] = useState<ProfileNavigationMedia[]>([]);
  const [timelinePosts, setTimelinePosts] = useState<ProfileNavigationPost[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [canViewProfile, setCanViewProfile] = useState(false);
  const [viewState, setViewState] = useState<ProfileViewState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [hasMoreMedia, setHasMoreMedia] = useState(false);
  const [mediaOffset, setMediaOffset] = useState(0);
  const [mediaPostCount, setMediaPostCount] = useState(0);
  const [isLoadingMoreMedia, setIsLoadingMoreMedia] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const loadSequence = useRef(0);
  const loadingMoreRef = useRef(false);
  const pendingChatTarget = useRef<ProfileNavigationProfile | null>(null);
  const chatSystemReady = useRef(false);
  const [chatSystemMounted, setChatSystemMounted] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [reelStudioOpen, setReelStudioOpen] = useState(false);
  const [isCoverUploading, setIsCoverUploading] = useState(false);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!coverPreviewUrl?.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(coverPreviewUrl);
  }, [coverPreviewUrl]);

  const loadMediaPage = useCallback(async (targetUserId: string, start: number) => {
    return supabase
      .from("posts")
      .select(
        "id,author_id,content,media_url,image_url,image_urls,cover_url,media_type,type,created_at,likes_count,comments_count,shares_count,views_count,meta_title,meta_description",
        { count: "exact" },
      )
      .eq("author_id", targetUserId)
      .or(MEDIA_POST_FILTER)
      .order("created_at", { ascending: false })
      .range(start, start + MEDIA_PAGE_SIZE - 1);
  }, []);

  useEffect(() => {
    const sequence = ++loadSequence.current;
    let active = true;
    loadingMoreRef.current = false;
    setProfile(null);
    setFriends([]);
    setSendingFriendIds(new Set());
    setMedia([]);
    setTimelinePosts([]);
    setIsConnected(false);
    setCanViewProfile(false);
    setViewState("loading");
    setErrorMessage(undefined);
    setHasMoreMedia(false);
    setMediaOffset(0);
    setMediaPostCount(0);
    setIsLoadingMoreMedia(false);

    const load = async () => {
      if (!userId || !currentUserId) {
        setErrorMessage("This profile isn’t available.");
        setViewState("error");
        return;
      }

      const isOwnProfile = userId === currentUserId;
      const [profileResult, friendshipResult, blockResult] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id,full_name,username,avatar_url,cover_url,bio,location,school,profile_locked,is_private_mode",
          )
          .eq("id", userId)
          .maybeSingle(),
        !isOwnProfile
          ? supabase
              .from("friendships")
              .select("status")
              .or(
                `and(sender_id.eq.${currentUserId},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUserId})`,
              )
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        !isOwnProfile
          ? supabase
              .from("user_blocks")
              .select("blocked_id")
              .eq("blocker_id", currentUserId)
              .eq("blocked_id", userId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (!active || sequence !== loadSequence.current) return;
      if (profileResult.error || !profileResult.data) {
        console.error("[ProfileTimelinePage] profile load failed:", profileResult.error);
        setErrorMessage("This profile isn’t available.");
        setViewState("error");
        return;
      }

      if (!isOwnProfile && (blockResult.data || blockResult.error)) {
        setErrorMessage("This profile isn’t available.");
        setViewState("error");
        return;
      }

      const profileData: ProfileNavigationProfile = {
        ...profileResult.data,
        full_name:
          profileResult.data.full_name ||
          profileResult.data.username ||
          "Flicks member",
      };
      const status = (friendshipResult.data as FriendshipStatusRow | null)?.status;
      const connected = isOwnProfile || status === "accepted";
      let privateAccess = true;
      if (profileData.is_private_mode === true && !connected) {
        privateAccess = await canViewPrivateProfile(userId);
      }
      const restricted =
        (profileData.profile_locked === true && !connected) ||
        (profileData.is_private_mode === true && !privateAccess);

      if (!active || sequence !== loadSequence.current) return;
      setProfile(profileData);
      setIsConnected(connected);
      setCanViewProfile(privateAccess);

      if (restricted) {
        setViewState("ready");
        return;
      }

      const [friendsResult, mediaResult, viewerFriendshipsResult] = await Promise.all([
        loadUserFriendships(userId, true),
        loadMediaPage(userId, 0),
        loadUserFriendships(currentUserId, false),
      ]);

      if (!active || sequence !== loadSequence.current) return;
      if (friendsResult.error) {
        console.error("[ProfileTimelinePage] friends load failed:", friendsResult.error);
        setFriends([]);
      } else {
        const rows = friendsResult.rows;
        const friendIds = [
          ...new Set(
            rows
              .map((row) =>
                row.sender_id === userId ? row.receiver_id : row.sender_id,
              )
              .filter((friendId) => friendId && friendId !== userId),
          ),
        ];

        if (friendIds.length === 0) {
          setFriends([]);
        } else {
          const profileResults = await Promise.all(
            chunkIds(friendIds, PROFILE_QUERY_BATCH_SIZE).map((ids) =>
              supabase
                .from("profiles")
                .select("id,full_name,avatar_url,location")
                .in("id", ids),
            ),
          );

          if (!active || sequence !== loadSequence.current) return;
          const failedProfileResult = profileResults.find((result) => result.error);
          if (failedProfileResult?.error) {
            console.error(
              "[ProfileTimelinePage] friend profiles load failed:",
              failedProfileResult.error,
            );
            setFriends([]);
          } else {
            const friendProfiles = profileResults.flatMap(
              (result) => (result.data ?? []) as FriendProfileRow[],
            );
            const profilesById = new Map(
              friendProfiles.map((friend) => [
                friend.id,
                friend,
              ]),
            );
            const relationshipByFriendId = new Map<
              string,
              { status: "pending" | "accepted"; direction: "outgoing" | "incoming" }
            >();
            if (!viewerFriendshipsResult.error) {
              for (const row of viewerFriendshipsResult.rows) {
                const otherId =
                  row.sender_id === currentUserId ? row.receiver_id : row.sender_id;
                if (!friendIds.includes(otherId)) continue;
                const next = {
                  status: row.status,
                  direction: row.sender_id === currentUserId ? "outgoing" as const : "incoming" as const,
                };
                const existing = relationshipByFriendId.get(otherId);
                if (!existing || row.status === "accepted") {
                  relationshipByFriendId.set(otherId, next);
                }
              }
            }
            const mutualFriendIds = new Set(
              friendIds.filter((friendId) =>
                friendId !== currentUserId &&
                friendId !== userId &&
                relationshipByFriendId.get(friendId)?.status === "accepted",
              ),
            );
            const friendList = friendIds.reduce<ProfileNavigationFriend[]>(
              (result, friendId) => {
                const friend = profilesById.get(friendId);
                if (friend) {
                  const relationship = relationshipByFriendId.get(friendId);
                  result.push({
                    id: friend.id,
                    full_name: friend.full_name || "Flicks member",
                    avatar_url: friend.avatar_url || null,
                    location: friend.location || null,
                    relationshipStatus:
                      friend.id === currentUserId
                        ? "accepted"
                        : relationship?.status ??
                          (viewerFriendshipsResult.error ? "unknown" : "none"),
                    requestDirection: relationship?.direction,
                    isViewer: friend.id === currentUserId,
                    isMutual: mutualFriendIds.has(friend.id),
                  });
                }
                return result;
              },
              [],
            );
            setFriends(friendList);
          }
        }
      }

      if (mediaResult.error) {
        console.error("[ProfileTimelinePage] media load failed:", mediaResult.error);
        setHasMoreMedia(false);
      } else {
        const mediaRows = (mediaResult.data ?? []) as MediaPostRow[];
        setMedia(toMediaItems(mediaRows));
        setTimelinePosts(mediaRows);
        setMediaPostCount(mediaResult.count ?? mediaRows.length);
        setMediaOffset(mediaRows.length);
        setHasMoreMedia(
          (mediaResult.count ?? mediaRows.length) > mediaRows.length,
        );
      }

      setViewState("ready");
    };

    void load().catch((error: unknown) => {
      console.error("[ProfileTimelinePage] load failed:", error);
      if (!active || sequence !== loadSequence.current) return;
      setErrorMessage("Please try opening this profile again.");
      setViewState("error");
    });

    return () => {
      active = false;
    };
  }, [currentUserId, userId, reloadVersion, loadMediaPage]);

  const retry = useCallback(() => {
    setReloadVersion((version) => version + 1);
  }, []);

  const handleCoverSelection = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      if (!file) return;

      if (!profile || profile.id !== currentUserId) {
        toast.error("Only the profile owner can change this cover photo.");
        input.value = "";
        return;
      }
      if (!file.type.startsWith("image/")) {
        toast.error("Choose an image file for your cover photo.");
        input.value = "";
        return;
      }
      if (file.size > 12 * 1024 * 1024) {
        toast.error("Cover photos must be 12 MB or smaller.");
        input.value = "";
        return;
      }

      setCoverPreviewUrl(URL.createObjectURL(file));
      setIsCoverUploading(true);
      try {
        const extension =
          file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
        const fileName = `${profile.id}-cover-${Date.now()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(fileName, file, {
            contentType: file.type,
            upsert: true,
          });
        if (uploadError) throw uploadError;

        const publicUrl = supabase.storage.from("avatars").getPublicUrl(fileName)
          .data.publicUrl;
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ cover_url: publicUrl })
          .eq("id", profile.id);
        if (profileError) {
          await supabase.storage.from("avatars").remove([fileName]);
          throw profileError;
        }

        setProfile((current) =>
          current?.id === profile.id
            ? { ...current, cover_url: publicUrl }
            : current,
        );
        setCoverPreviewUrl(null);
        window.dispatchEvent(new CustomEvent("flicks-profile-updated"));
        toast.success("Cover photo updated.");
      } catch (error) {
        console.error("[ProfileTimelinePage] cover upload failed:", error);
        setCoverPreviewUrl(null);
        toast.error("Your cover photo could not be updated. Please try again.");
      } finally {
        setIsCoverUploading(false);
        input.value = "";
      }
    },
    [currentUserId, profile],
  );

  const profileForDisplay =
    profile && coverPreviewUrl
      ? { ...profile, cover_url: coverPreviewUrl }
      : profile;

  const openReelStudio = useCallback(() => setReelStudioOpen(true), []);
  const closeReelStudio = useCallback(() => setReelStudioOpen(false), []);

  const loadMoreMedia = useCallback(async () => {
    if (!userId || loadingMoreRef.current || mediaOffset >= mediaPostCount) return;
    loadingMoreRef.current = true;
    setIsLoadingMoreMedia(true);
    const sequence = loadSequence.current;
    const start = mediaOffset;

    try {
      const { data, count, error } = await loadMediaPage(userId, start);
      if (sequence !== loadSequence.current) return;
      if (error) {
        console.error("[ProfileTimelinePage] more media load failed:", error);
        return;
      }

      const rows = (data ?? []) as MediaPostRow[];
      const nextItems = toMediaItems(rows);
      setTimelinePosts((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...rows.filter((item) => !seen.has(item.id))];
      });
      setMedia((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...nextItems.filter((item) => !seen.has(item.id))];
      });
      const nextOffset = start + rows.length;
      const total = count ?? mediaPostCount;
      setMediaOffset(nextOffset);
      setMediaPostCount(total);
      setHasMoreMedia(nextOffset < total);
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMoreMedia(false);
    }
  }, [loadMediaPage, mediaOffset, mediaPostCount, userId]);

  const onChatReady = useCallback(() => {
    chatSystemReady.current = true;
    const target = pendingChatTarget.current;
    if (!target) return;
    pendingChatTarget.current = null;
    dispatchOpenChat(target);
  }, []);

  const openMessage = useCallback((target: ProfileNavigationProfile) => {
    pendingChatTarget.current = target;
    setChatSystemMounted(true);
    setChatOpen(true);
    if (chatSystemReady.current) {
      pendingChatTarget.current = null;
      dispatchOpenChat(target);
    }
  }, []);

  const handleProfilePostEdited = useCallback(
    (postId: string, content: string) => {
      setTimelinePosts((previous) =>
        previous.map((post) =>
          post.id === postId ? { ...post, content } : post,
        ),
      );
    },
    [],
  );

  const handleProfilePostDeleted = useCallback(
    (postId: string) => {
      const isProfilePost = timelinePosts.some((post) => post.id === postId);
      if (!isProfilePost) return;

      setTimelinePosts((previous) =>
        previous.filter((post) => post.id !== postId),
      );
      setMedia((previous) =>
        previous.filter((item) => !item.id.startsWith(`${postId}:`)),
      );
      setMediaOffset((previous) => Math.max(0, previous - 1));
      setMediaPostCount((previous) => Math.max(0, previous - 1));
    },
    [timelinePosts],
  );

  const handleShareProfilePost = useCallback(
    async (postId: string) => {
      const post = timelinePosts.find((item) => item.id === postId);
      if (!post) {
        toast.error("This post is no longer available.");
        return;
      }

      const authorName = profile?.full_name || "Flicks member";
      const title = post.meta_title?.trim() || `${authorName}'s post`;
      const url = buildPostShareUrl(postId);
      const rawSummary = (post.meta_description || post.content || "")
        .replace(/\s+/g, " ")
        .trim();
      const summary = rawSummary.length > 180
        ? `${rawSummary.slice(0, 177).trimEnd()}…`
        : rawSummary;
      const shareText = [
        title,
        summary && summary !== title ? summary : "",
        `— ${authorName} on Flicks India`,
      ]
        .filter(Boolean)
        .join("\n\n");
      try {
        if (
          typeof window.AndroidShare?.shareMedia === "function" ||
          typeof window.AndroidShare?.shareText === "function"
        ) {
          const outcome = await sharePost({
            postId,
            caption: post.content,
            mediaUrl:
              post.media_url ||
              post.image_url ||
              post.image_urls?.[0] ||
              post.cover_url ||
              undefined,
            mediaType: post.media_type || post.type || undefined,
            authorName,
            metaTitle: post.meta_title,
            metaDescription: post.meta_description,
          });
          if (outcome === "cancelled") return;
          if (outcome === "copied") toast.success("Post link copied.");
        } else if (navigator.share) {
          await navigator.share({
            title,
            text: shareText,
            url,
          });
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(`${shareText}\n\n${url}`);
          toast.success("Post link copied.");
        } else if (window.prompt("Copy this post link", url) === null) {
          return;
        } else {
          toast.success("Post link ready to share.");
        }

        if (!currentUserId) return;
        const { error } = await supabase.from("shares").insert({
          post_id: postId,
          user_id: currentUserId,
        });
        if (!error) {
          setTimelinePosts((previous) =>
            previous.map((item) =>
              item.id === postId
                ? { ...item, shares_count: (item.shares_count ?? 0) + 1 }
                : item,
            ),
          );
        } else if (error.code !== "23505") {
          console.warn("[ProfileTimelinePage] share tracking failed:", error);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("[ProfileTimelinePage] share failed:", error);
        toast.error("The post could not be shared. Please try again.");
      }
    },
    [currentUserId, profile?.full_name, timelinePosts],
  );

  const wall =
    profile && viewState === "ready" ? (
      <FriendWall
        profileId={profile.id}
        friendName={profile.full_name}
        canPost={isConnected || profile.id === currentUserId}
        currentUserId={currentUserId}
        isOwnProfile={profile.id === currentUserId}
        onCreateHook={openReelStudio}
        onPostEditedInProfile={handleProfilePostEdited}
        onPostDeletedInProfile={handleProfilePostDeleted}
      />
    ) : null;

  const onFriendSelect = useCallback(
    (friend: ProfileNavigationFriend) => {
      navigate(`/profile/${encodeURIComponent(friend.id)}`);
      window.scrollTo({ top: 0, behavior: "instant" });
    },
    [navigate],
  );

  const handleSendFriendRequest = useCallback(
    async (friend: ProfileNavigationFriend) => {
      if (
        !currentUserId ||
        friend.id === currentUserId ||
        friend.relationshipStatus !== "none" ||
        sendingFriendIds.has(friend.id)
      ) {
        return;
      }

      setSendingFriendIds((current) => new Set(current).add(friend.id));
      try {
        if (!(await canViewPrivateProfile(friend.id))) {
          toast.error("This profile is unavailable.");
          return;
        }

        const { error } = await supabase.from("friendships").insert({
          sender_id: currentUserId,
          receiver_id: friend.id,
          status: "pending",
        });

        if (error) {
          const isDuplicate =
            error.code === "23505" ||
            /duplicate|unique/i.test(error.message || "");
          if (isDuplicate) {
            const { data: existing } = await supabase
              .from("friendships")
              .select("sender_id,receiver_id,status")
              .or(
                `and(sender_id.eq.${currentUserId},receiver_id.eq.${friend.id}),and(sender_id.eq.${friend.id},receiver_id.eq.${currentUserId})`,
              )
              .maybeSingle();
            const status = existing?.status === "accepted" ? "accepted" : "pending";
            setFriends((current) =>
              current.map((item) =>
                item.id === friend.id
                  ? {
                      ...item,
                      relationshipStatus: status,
                      requestDirection:
                        existing?.sender_id === currentUserId ? "outgoing" : "incoming",
                    }
                  : item,
              ),
            );
            toast.info(
              status === "accepted"
                ? "You are already friends."
                : "A friend request is already pending.",
            );
            return;
          }
          toast.error("Friend request could not be sent. Please try again.");
          return;
        }

        setFriends((current) =>
          current.map((item) =>
            item.id === friend.id
              ? {
                  ...item,
                  relationshipStatus: "pending",
                  requestDirection: "outgoing",
                }
              : item,
          ),
        );
        const { error: notificationError } = await supabase
          .from("notifications")
          .insert({
            notifier_id: friend.id,
            actor_id: currentUserId,
            type: "friend_request",
            entity_id: friend.id,
            content: "sent you a friend request",
            is_read: false,
          });
        if (notificationError) {
          console.warn(
            "[ProfileTimelinePage] friend request notification failed:",
            notificationError.message,
          );
        }
        toast.success("Friend request sent.");
      } catch (error) {
        console.error("[ProfileTimelinePage] friend request failed:", error);
        toast.error("Friend request could not be sent. Please try again.");
      } finally {
        setSendingFriendIds((current) => {
          const next = new Set(current);
          next.delete(friend.id);
          return next;
        });
      }
    },
    [currentUserId, sendingFriendIds],
  );

  return (
    <>
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Choose a profile cover photo"
        data-testid="input-profile-cover"
        onChange={(event) => void handleCoverSelection(event)}
      />
      <FullProfilePage
        profile={profileForDisplay}
        friendWall={wall}
        media={media}
        hooks={timelinePosts.filter(isVideoTimelinePost)}
        imagePosts={timelinePosts.filter(isImageTimelinePost)}
        currentUserId={currentUserId}
        onPostEdited={handleProfilePostEdited}
        onPostDeleted={handleProfilePostDeleted}
        onSharePost={handleShareProfilePost}
        friends={friends}
        isConnected={isConnected}
        canViewProfile={canViewProfile}
        state={viewState}
        isOwnProfile={profile?.id === currentUserId}
        isCoverUploading={isCoverUploading}
        onEditCover={() => openFilePicker(coverInputRef.current)}
        errorMessage={errorMessage}
        hasMoreMedia={hasMoreMedia}
        isLoadingMoreMedia={isLoadingMoreMedia}
        onRetry={retry}
        onLoadMoreMedia={() => void loadMoreMedia()}
        onMessage={
          isConnected && profile?.id !== currentUserId
            ? openMessage
            : undefined
        }
        onFriendSelect={onFriendSelect}
        onSendFriendRequest={(friend) => void handleSendFriendRequest(friend)}
        sendingFriendIds={sendingFriendIds}
        onBack={() => navigate("/", { replace: true })}
      />
      {chatSystemMounted && (
        <Suspense fallback={null}>
          <ChatSystem
            isOpen={chatOpen}
            onClose={() => setChatOpen(false)}
            userId={currentUserId}
            userEmail={currentUserEmail}
            onReady={onChatReady}
          />
        </Suspense>
      )}
      {reelStudioOpen && profile?.id === currentUserId && (
        <Suspense fallback={null}>
          <ReelStudio
            isOpen
            userId={currentUserId}
            userProfile={{ full_name: profile.full_name }}
            onClose={closeReelStudio}
            onSaved={() => {
              setReelStudioOpen(false);
              retry();
            }}
          />
        </Suspense>
      )}
    </>
  );
}
