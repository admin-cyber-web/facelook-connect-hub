import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { canViewPrivateProfile } from "@/lib/profileSearch";
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
  id: string;
  sender_id: string;
  receiver_id: string;
  ["profiles!friendships_sender_id_fkey"]?: ProfileNavigationFriend | null;
  ["profiles!friendships_receiver_id_fkey"]?: ProfileNavigationFriend | null;
}

interface MediaPostRow {
  id: string;
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
}

interface FriendshipStatusRow {
  status: "none" | "pending" | "accepted";
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

  const loadMediaPage = useCallback(async (targetUserId: string, start: number) => {
    return supabase
      .from("posts")
      .select(
        "id,content,media_url,image_url,image_urls,cover_url,media_type,type,created_at,likes_count,comments_count,shares_count",
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
            "id,full_name,username,avatar_url,bio,location,school,profile_locked,is_private_mode",
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

      const [friendsResult, mediaResult] = await Promise.all([
        supabase
          .from("friendships")
          .select(
            "id,sender_id,receiver_id,profiles!friendships_sender_id_fkey(id,full_name,avatar_url),profiles!friendships_receiver_id_fkey(id,full_name,avatar_url)",
          )
          .eq("status", "accepted")
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
          .order("created_at", { ascending: false })
          .limit(1000),
        loadMediaPage(userId, 0),
      ]);

      if (!active || sequence !== loadSequence.current) return;
      if (friendsResult.error) {
        console.error("[ProfileTimelinePage] friends load failed:", friendsResult.error);
        setFriends([]);
      } else {
        const rows = (friendsResult.data ?? []) as unknown as FriendshipRow[];
        setFriends(
          rows
            .map((row) => {
              const isSender = row.sender_id === userId;
              const friend = isSender
                ? row["profiles!friendships_receiver_id_fkey"]
                : row["profiles!friendships_sender_id_fkey"];
              return friend?.id && friend.id !== userId
                ? {
                    id: friend.id,
                    full_name: friend.full_name || "Flicks member",
                    avatar_url: friend.avatar_url || null,
                  }
                : null;
            })
            .filter((friend): friend is ProfileNavigationFriend => friend !== null),
        );
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

  const wall =
    profile && viewState === "ready" ? (
      <FriendWall
        profileId={profile.id}
        friendName={profile.full_name}
        canPost={isConnected || profile.id === currentUserId}
        currentUserId={currentUserId}
        isOwnProfile={profile.id === currentUserId}
        onCreateHook={openReelStudio}
      />
    ) : null;

  const onFriendSelect = useCallback(
    (friend: ProfileNavigationFriend) => {
      navigate(`/profile/${encodeURIComponent(friend.id)}`);
      window.scrollTo({ top: 0, behavior: "instant" });
    },
    [navigate],
  );

  return (
    <>
      <FullProfilePage
        profile={profile}
        friendWall={wall}
        media={media}
        hooks={timelinePosts.filter(isVideoTimelinePost)}
        imagePosts={timelinePosts.filter(isImageTimelinePost)}
        friends={friends}
        isConnected={isConnected}
        canViewProfile={canViewProfile}
        state={viewState}
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
