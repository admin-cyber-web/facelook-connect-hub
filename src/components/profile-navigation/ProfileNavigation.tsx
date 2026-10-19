import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import AutoPlayMutedVideo from "@/components/AutoPlayMutedVideo";
import {
  ProfileTimelineAudioProvider,
  ProfileTimelineSoundControl,
} from "./ProfileTimelineAudio";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  GraduationCap,
  Image as ImageIcon,
  LockKeyhole,
  Loader2,
  MapPin,
  MessageCircle,
  Play,
  RotateCw,
  ShieldCheck,
  Users,
  UserPlus,
  X,
  Video,
} from "lucide-react";
import "./profile-navigation.css";
import SavePostButton from "@/components/SavePostButton";
import type {
  FullProfilePageProps,
  ProfileNavigationFriend,
  ProfileNavigationMedia,
  ProfileNavigationPost,
  ProfileNavigationProfile,
  ProfileViewState,
  QuickProfileModalProps,
} from "./profileNavigation.types";

const DEFAULT_PROFILE_COVER =
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=2200&q=88";

export type {
  FullProfilePageProps,
  ProfileNavigationFriend,
  ProfileNavigationMedia,
  ProfileNavigationPost,
  ProfileNavigationProfile,
  ProfileViewState,
  QuickProfileModalProps,
} from "./profileNavigation.types";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function Avatar({
  name,
  src,
  variant,
}: {
  name: string;
  src?: string | null;
  variant: "hero" | "friend";
}) {
  return (
    <div className={`profile-nav-avatar profile-nav-avatar--${variant}`}>
      {src ? (
        <img src={src} alt={`${name} profile`} loading="lazy" decoding="async" />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
    </div>
  );
}

function ProfileIdentity({
  profile,
  avatarVariant,
  centered = false,
}: {
  profile: ProfileNavigationProfile;
  avatarVariant: "hero" | "friend";
  centered?: boolean;
}) {
  const identityTop = (
    <>
      {centered ? (
        <p className="profile-nav-kicker">Quick profile</p>
      ) : (
        <span className="profile-nav-member-badge" data-testid="status-profile-member">
          Flicks Member
        </span>
      )}
      <h1 className="profile-nav-name" data-testid="text-profile-name">
        {profile.full_name}
      </h1>
      {profile.username && (
        <p className="profile-nav-username" data-testid="text-profile-username">
          @{profile.username}
        </p>
      )}
    </>
  );
  const identityDetails = (
    <>
      {profile.bio && (
        <p className="profile-nav-bio" data-testid="text-profile-bio">
          {profile.bio}
        </p>
      )}
      {(profile.location || profile.school) && (
        <div className="profile-nav-facts">
          {profile.location && (
            <span className="profile-nav-fact" data-testid="text-profile-location">
              <MapPin size={14} aria-hidden="true" />
              {profile.location}
            </span>
          )}
          {profile.school && (
            <span className="profile-nav-fact" data-testid="text-profile-school">
              <GraduationCap size={15} aria-hidden="true" />
              {profile.school}
            </span>
          )}
        </div>
      )}
    </>
  );

  if (centered) {
    return (
      <div className="profile-nav-modal-profile">
        <Avatar name={profile.full_name} src={profile.avatar_url} variant={avatarVariant} />
        {identityTop}
        {identityDetails}
      </div>
    );
  }

  return (
    <div className="profile-nav-hero-content">
      <Avatar name={profile.full_name} src={profile.avatar_url} variant={avatarVariant} />
      <div className="profile-nav-identity-copy">
        {identityTop}
        {identityDetails}
      </div>
    </div>
  );
}

function MutualFriendsNote({ friends }: { friends: ProfileNavigationFriend[] }) {
  const mutualFriends = friends.filter((friend) => friend.isMutual);
  if (mutualFriends.length === 0) return null;

  const firstName = mutualFriends[0].full_name;
  const others = mutualFriends.length - 1;
  const text = others > 0
    ? `${firstName} and ${others} other mutual ${others === 1 ? "friend" : "friends"}`
    : `${firstName} is a mutual friend`;

  return (
    <p className="profile-nav-mutual-note" data-testid="text-profile-mutual-friends">
      <Users size={14} aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}

function HeaderFriendsStrip({
  friends,
  onFriendSelect,
  onSendFriendRequest,
  sendingFriendIds,
}: {
  friends: ProfileNavigationFriend[];
  onFriendSelect?: (friend: ProfileNavigationFriend) => void;
  onSendFriendRequest?: (friend: ProfileNavigationFriend) => void;
  sendingFriendIds?: ReadonlySet<string>;
}) {
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);

  useEffect(() => {
    if (!isFriendsOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFriendsOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFriendsOpen]);

  if (friends.length === 0) return null;

  return (
    <>
      <div className="profile-nav-header-friends" aria-label="Friends preview">
        <div className="profile-nav-header-friends-strip" data-testid="list-profile-header-friends">
          {friends.slice(0, 6).map((friend) => (
            <button
              key={friend.id}
              type="button"
              className="profile-nav-header-friend"
              onClick={() => onFriendSelect?.(friend)}
              data-testid={`button-profile-header-friend-${friend.id}`}
            >
              <Avatar name={friend.full_name} src={friend.avatar_url} variant="friend" />
              <span className="profile-nav-header-friend-name">{friend.full_name}</span>
            </button>
          ))}
          <button
            type="button"
            className="profile-nav-header-friends-more"
            onClick={() => setIsFriendsOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={isFriendsOpen}
            data-testid="button-profile-header-friends-more"
          >
            More
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
        <MutualFriendsNote friends={friends} />
      </div>
      {isFriendsOpen &&
        createPortal(
          <div
            className="profile-nav profile-nav-friends-dialog-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setIsFriendsOpen(false);
            }}
          >
            <section
              className="profile-nav-friends-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="profile-nav-friends-dialog-title"
              data-testid="dialog-profile-friends"
            >
              <header className="profile-nav-friends-dialog-header">
                <div>
                  <p className="profile-nav-kicker">Good company</p>
                  <h2 id="profile-nav-friends-dialog-title">Friends</h2>
                  <span>{friends.length} friends</span>
                </div>
                <button
                  type="button"
                  className="profile-nav-modal-close"
                  aria-label="Close friends list"
                  onClick={() => setIsFriendsOpen(false)}
                  data-testid="button-close-profile-friends"
                >
                  <X size={17} aria-hidden="true" />
                </button>
              </header>
              <MutualFriendsNote friends={friends} />
              <div className="profile-nav-friends-dialog-list" role="list">
                {friends.map((friend) => (
                  <FriendRow
                    key={friend.id}
                    friend={friend}
                    onFriendSelect={(selected) => {
                      setIsFriendsOpen(false);
                      onFriendSelect?.(selected);
                    }}
                    onSendFriendRequest={onSendFriendRequest}
                    isSending={sendingFriendIds?.has(friend.id) ?? false}
                  />
                ))}
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}

function ProfileHeader({
  profile,
  friends,
  isConnected,
  canViewProfile,
  isOwnProfile,
  isCoverUploading,
  onMessage,
  onBack,
  onEditCover,
  onFriendSelect,
  onSendFriendRequest,
  sendingFriendIds,
}: {
  profile: ProfileNavigationProfile;
  friends: ProfileNavigationFriend[];
  isConnected: boolean;
  canViewProfile: boolean;
  isOwnProfile: boolean;
  isCoverUploading: boolean;
  onMessage?: (profile: ProfileNavigationProfile) => void;
  onBack?: () => void;
  onEditCover?: () => void;
  onFriendSelect?: (friend: ProfileNavigationFriend) => void;
  onSendFriendRequest?: (friend: ProfileNavigationFriend) => void;
  sendingFriendIds?: ReadonlySet<string>;
}) {
  const hasRestrictedAccess =
    (profile.profile_locked === true && !isConnected) ||
    (profile.is_private_mode === true && !canViewProfile);

  return (
    <>
      <div className="profile-nav-topline">
        {onBack ? (
          <button type="button" className="profile-nav-back" onClick={onBack} data-testid="button-profile-back">
            <ArrowLeft size={15} aria-hidden="true" />
            Back to friends
          </button>
        ) : (
          <span className="profile-nav-kicker">Flicks India / profile</span>
        )}
        <span className="profile-nav-kicker">A little more personal</span>
      </div>
      <header className="profile-nav-hero">
        <div className="profile-nav-cover" data-testid="banner-profile-cover">
          <img
            className="profile-nav-cover-image"
            src={profile.cover_url || DEFAULT_PROFILE_COVER}
            alt={`${profile.full_name} cover`}
            loading="eager"
            decoding="async"
          />
          <div className="profile-nav-cover-shade" aria-hidden="true" />
          {isOwnProfile && onEditCover && (
            <button
              type="button"
              className="profile-nav-cover-button"
              onClick={onEditCover}
              disabled={isCoverUploading}
              data-testid="button-edit-profile-cover"
            >
              <Camera size={16} aria-hidden="true" />
              {isCoverUploading ? "Uploading…" : "Change cover"}
            </button>
          )}
        </div>
        <ProfileIdentity profile={profile} avatarVariant="hero" />
        <HeaderFriendsStrip
          friends={friends}
          onFriendSelect={onFriendSelect}
          onSendFriendRequest={onSendFriendRequest}
          sendingFriendIds={sendingFriendIds}
        />
        {hasRestrictedAccess && (
          <div className="profile-nav-hero-actions">
            <span className="profile-nav-access-pill">
              <LockKeyhole size={13} aria-hidden="true" />
              {profile.is_private_mode ? "Private mode" : "Locked profile"}
            </span>
          </div>
        )}
        {isConnected && onMessage && (
          <div className="profile-nav-hero-actions">
            <button
              type="button"
              className="profile-nav-action"
              onClick={() => onMessage(profile)}
              data-testid="button-profile-message"
            >
              <MessageCircle size={16} aria-hidden="true" />
              Message
            </button>
          </div>
        )}
      </header>
    </>
  );
}

function EmptyState({
  icon,
  title,
  copy,
}: {
  icon: ReactNode;
  title: string;
  copy: string;
}) {
  return (
    <div className="profile-nav-empty">
      <div>
        <span className="profile-nav-empty-mark">{icon}</span>
        <strong>{title}</strong>
        <p>{copy}</p>
      </div>
    </div>
  );
}

function MediaGallery({
  media,
  hasMoreMedia,
  isLoadingMoreMedia,
  onLoadMoreMedia,
}: {
  media: ProfileNavigationMedia[];
  hasMoreMedia: boolean;
  isLoadingMoreMedia: boolean;
  onLoadMoreMedia?: () => void;
}) {
  const items = media.filter((item) => item.url || item.preview_url);

  return (
    <section className="profile-nav-section" aria-labelledby="profile-nav-media-heading">
      <div className="profile-nav-section-head">
        <div>
          <p className="profile-nav-kicker">Collected moments</p>
          <h2 className="profile-nav-section-title" id="profile-nav-media-heading">
            Photos &amp; Albums
          </h2>
        </div>
        <span className="profile-nav-section-count">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={<ImageIcon size={17} aria-hidden="true" />}
          title="No media just yet"
          copy="Photos and videos shared on the timeline will find their way here."
        />
      ) : (
        <div className="profile-nav-gallery" data-testid="grid-profile-media">
          {items.map((item) => {
            const isVideo = item.media_type?.toLowerCase().includes("video") ?? false;
            return (
              <div className="profile-nav-media" key={item.id} data-testid={`media-profile-${item.id}`}>
                {isVideo ? (
                  <AutoPlayMutedVideo
                    src={item.url}
                    poster={item.preview_url || undefined}
                    controls
                    ariaLabel="Video from timeline"
                    preload="none"
                    autoplayWithSound
                    passThroughClicks={false}
                  />
                ) : (
                  <img
                    src={item.preview_url || item.url}
                    alt="Photo"
                    loading="lazy"
                    decoding="async"
                  />
                )}
                {isVideo && (
                  <span className="profile-nav-media-video" aria-label="Video">
                    <Play size={12} fill="currentColor" aria-hidden="true" />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {hasMoreMedia && onLoadMoreMedia && (
        <button
          className="profile-nav-load-more"
          type="button"
          onClick={onLoadMoreMedia}
          disabled={isLoadingMoreMedia}
          data-testid="button-load-more-profile-media"
        >
          {isLoadingMoreMedia ? "Loading…" : "Load more"}
        </button>
      )}
    </section>
  );
}

function FriendRow({
  friend,
  onFriendSelect,
  onSendFriendRequest,
  isSending = false,
}: {
  friend: ProfileNavigationFriend;
  onFriendSelect?: (friend: ProfileNavigationFriend) => void;
  onSendFriendRequest?: (friend: ProfileNavigationFriend) => void;
  isSending?: boolean;
}) {
  const profileContent = (
    <>
      <Avatar name={friend.full_name} src={friend.avatar_url} variant="friend" />
      <span className="profile-nav-friend-copy">
        <span className="profile-nav-friend-name" data-testid={`text-profile-friend-${friend.id}`}>
          {friend.full_name}
        </span>
        <span
          className="profile-nav-friend-location"
          data-testid={`text-profile-friend-location-${friend.id}`}
        >
          <MapPin size={12} aria-hidden="true" />
          {friend.location || "Location not shared"}
        </span>
      </span>
      {friend.isMutual && <span className="profile-nav-friend-mutual">Mutual</span>}
      <span className="profile-nav-friend-badge">Friend</span>
      {onFriendSelect && <ArrowRight className="profile-nav-friend-arrow" size={15} aria-hidden="true" />}
    </>
  );

  const profileButton = onFriendSelect ? (
    <button
      className="profile-nav-friend"
      type="button"
      onClick={() => onFriendSelect(friend)}
      data-testid={`button-profile-friend-${friend.id}`}
    >
      {profileContent}
    </button>
  ) : (
    <div className="profile-nav-friend" data-testid={`row-profile-friend-${friend.id}`}>
      {profileContent}
    </div>
  );

  const relationshipStatus = friend.relationshipStatus ?? "unknown";
  let action: ReactNode = null;
  if (!friend.isViewer && onSendFriendRequest && relationshipStatus === "none") {
    action = (
      <button
        className="profile-nav-friend-request"
        type="button"
        onClick={() => onSendFriendRequest(friend)}
        disabled={isSending}
        data-testid={`button-add-profile-friend-${friend.id}`}
        aria-label={`${isSending ? "Sending request to" : "Add"} ${friend.full_name}`}
      >
        {isSending ? (
          <Loader2 size={14} className="profile-nav-request-spinner" aria-hidden="true" />
        ) : (
          <UserPlus size={14} aria-hidden="true" />
        )}
        {isSending ? "Sending…" : "Add Friend"}
      </button>
    );
  } else if (!friend.isViewer && relationshipStatus === "pending") {
    action = (
      <span className="profile-nav-friend-request-state" data-testid={`status-profile-friend-request-${friend.id}`}>
        {friend.requestDirection === "incoming" ? "Request received" : "Request sent"}
      </span>
    );
  } else if (!friend.isViewer && relationshipStatus === "accepted") {
    action = (
      <span className="profile-nav-friend-request-state is-connected" data-testid={`status-profile-friend-connected-${friend.id}`}>
        <Check size={13} aria-hidden="true" />
        Friends
      </span>
    );
  }

  return (
    <div className="profile-nav-friend-row" role="listitem" data-testid={`item-profile-friend-${friend.id}`}>
      {profileButton}
      {action}
    </div>
  );
}

function FriendsList({
  friends,
  onFriendSelect,
  onSendFriendRequest,
  sendingFriendIds,
}: {
  friends: ProfileNavigationFriend[];
  onFriendSelect?: (friend: ProfileNavigationFriend) => void;
  onSendFriendRequest?: (friend: ProfileNavigationFriend) => void;
  sendingFriendIds?: ReadonlySet<string>;
}) {
  return (
    <section
      className="profile-nav-section"
      aria-labelledby="profile-nav-friends-heading"
      id="profile-nav-friends-section"
    >
      <div className="profile-nav-section-head">
        <div>
          <p className="profile-nav-kicker">Good company</p>
          <h2 className="profile-nav-section-title" id="profile-nav-friends-heading">Friends</h2>
        </div>
        <span className="profile-nav-section-count">{friends.length}</span>
      </div>
      <MutualFriendsNote friends={friends} />
      {friends.length === 0 ? (
        <EmptyState
          icon={<Users size={17} aria-hidden="true" />}
          title="A quiet circle"
          copy="Friends will appear here as this circle grows."
        />
      ) : (
        <div className="profile-nav-list" data-testid="list-profile-friends" role="list">
          {friends.map((friend) => (
            <FriendRow
              key={friend.id}
              friend={friend}
              onFriendSelect={onFriendSelect}
              onSendFriendRequest={onSendFriendRequest}
              isSending={sendingFriendIds?.has(friend.id) ?? false}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function HooksSection({ posts }: { posts: ProfileNavigationPost[] }) {
  return (
    <section className="profile-nav-section" aria-labelledby="profile-nav-hooks-heading">
      <div className="profile-nav-section-head">
        <div>
          <p className="profile-nav-kicker">Short videos</p>
          <h2 className="profile-nav-section-title" id="profile-nav-hooks-heading">Hooks</h2>
        </div>
        <span className="profile-nav-section-count">{posts.length}</span>
      </div>
      {posts.length === 0 ? (
        <EmptyState
          icon={<Video size={17} aria-hidden="true" />}
          title="No Hooks yet"
          copy="Short videos shared on this timeline will appear here."
        />
      ) : (
        <div className="profile-nav-hooks-strip" data-testid="grid-profile-hooks">
          {posts.map((post) => (
            <article
              key={post.id}
              className="profile-nav-hook-card"
              data-testid={`card-profile-hook-${post.id}`}
            >
              {post.media_url && (
                <AutoPlayMutedVideo
                  src={post.media_url}
                  poster={post.cover_url || post.image_url || undefined}
                  controls
                  ariaLabel="Short video from timeline"
                  className="profile-nav-hook-video"
                  preload="none"
                  autoplayWithSound
                  passThroughClicks={false}
                />
              )}
              <div className="profile-nav-hook-save">
                <SavePostButton postId={post.id} className="profile-nav-save-button" />
              </div>
              <span
                className="profile-nav-hook-plays"
                data-testid={`text-hook-views-${post.id}`}
              >
                <Play size={13} fill="currentColor" aria-hidden="true" />
                {(post.views_count ?? 0).toLocaleString()} plays
              </span>
              {post.content && (
                <p className="profile-nav-hook-caption">
                  {post.content}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ImagePostsSection({ posts }: { posts: ProfileNavigationPost[] }) {
  const imagePosts = posts
    .map((post) => ({
      post,
      imageUrls: [
        ...(Array.isArray(post.image_urls) ? post.image_urls : []),
        post.image_url,
        post.media_url,
      ].filter((url): url is string => Boolean(url)),
    }))
    .filter(({ imageUrls }) => imageUrls.length > 0);

  return (
    <section className="profile-nav-section" aria-labelledby="profile-nav-image-posts-heading">
      <div className="profile-nav-section-head">
        <div>
          <p className="profile-nav-kicker">Shared snapshots</p>
          <h2 className="profile-nav-section-title" id="profile-nav-image-posts-heading">Image Posts</h2>
        </div>
        <span className="profile-nav-section-count">{imagePosts.length}</span>
      </div>
      {imagePosts.length === 0 ? (
        <EmptyState
          icon={<ImageIcon size={17} aria-hidden="true" />}
          title="No image posts yet"
          copy="Photos shared with a caption will appear here."
        />
      ) : (
        <div className="profile-nav-image-grid" data-testid="list-profile-image-posts">
          {imagePosts.map(({ post, imageUrls }) => (
            <article
              key={post.id}
              className="profile-nav-image-tile"
              data-testid={`card-profile-image-post-${post.id}`}
            >
              <div className={`profile-nav-image-collage ${imageUrls.length > 1 ? "is-multiple" : ""}`}>
                {imageUrls.slice(0, 4).map((url, index) => (
                  <img
                    key={`${post.id}-${url}-${index}`}
                    src={url}
                    alt={`Photo ${index + 1} in image post`}
                    loading="lazy"
                    decoding="async"
                  />
                ))}
              </div>
              <div className="profile-nav-image-caption">
                {post.content && <p>{post.content}</p>}
                <SavePostButton postId={post.id} className="profile-nav-save-button" />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ProfileLoading() {
  return (
    <div className="profile-nav-shell profile-nav-page-skeleton" role="status" aria-label="Loading profile">
      <div className="profile-nav-skeleton-hero">
        <div className="profile-nav-skeleton-circle" />
        <div className="profile-nav-skeleton-lines">
          <div className="profile-nav-skeleton-line" />
          <div className="profile-nav-skeleton-line" />
          <div className="profile-nav-skeleton-line" />
        </div>
      </div>
      <div className="profile-nav-skeleton-body">
        <div className="profile-nav-skeleton-card" />
        <div className="profile-nav-skeleton-card" />
      </div>
    </div>
  );
}

function ProfileError({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="profile-nav-shell profile-nav-state" role="alert">
      <div className="profile-nav-state-card">
        <span className="profile-nav-state-icon"><RotateCw size={21} aria-hidden="true" /></span>
        <h1 className="profile-nav-state-title">This profile didn’t load</h1>
        <p className="profile-nav-state-copy">
          {message || "Something interrupted the connection. Give it another try."}
        </p>
        {onRetry && (
          <button className="profile-nav-retry" type="button" onClick={onRetry} data-testid="button-retry-profile">
            <RotateCw size={14} aria-hidden="true" />
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

function RestrictedProfile({ profile }: { profile: ProfileNavigationProfile }) {
  const isPrivate = profile.is_private_mode === true;

  return (
    <section className="profile-nav-gate" aria-label="Profile access notice">
      <div className="profile-nav-gate-card">
        <span className="profile-nav-gate-icon">
          {isPrivate ? <ShieldCheck size={23} aria-hidden="true" /> : <LockKeyhole size={23} aria-hidden="true" />}
        </span>
        <h2 className="profile-nav-gate-title">
          {isPrivate ? "This profile is private" : "This profile is locked"}
        </h2>
        <p className="profile-nav-gate-copy">
          {isPrivate
            ? `${profile.full_name} shares their timeline, photos, and friends with their circle.`
            : `Only friends can see ${profile.full_name}’s timeline, photos, and friends.`}
        </p>
      </div>
    </section>
  );
}

export function FullProfilePage({
  profile,
  friendWall,
  media,
  hooks,
  imagePosts,
  friends,
  isConnected,
  canViewProfile = isConnected,
  isOwnProfile = false,
  isCoverUploading = false,
  state = "ready",
  errorMessage,
  hasMoreMedia = false,
  isLoadingMoreMedia = false,
  onRetry,
  onLoadMoreMedia,
  onMessage,
  onFriendSelect,
  onSendFriendRequest,
  sendingFriendIds,
  onBack,
  onEditCover,
}: FullProfilePageProps) {
  if (state === "loading") {
    return <main className="profile-nav profile-nav-page"><ProfileLoading /></main>;
  }

  if (state === "error" || !profile) {
    return (
      <main className="profile-nav profile-nav-page">
        <ProfileError message={errorMessage} onRetry={onRetry} />
      </main>
    );
  }

  const restricted =
    (profile.profile_locked === true && !isConnected) ||
    (profile.is_private_mode === true && !canViewProfile);
  const visibleProfile = restricted
    ? { ...profile, bio: null, location: null, school: null }
    : profile;

  return (
    <ProfileTimelineAudioProvider>
      <main className="profile-nav profile-nav-page">
        <div className="profile-nav-shell">
          <ProfileHeader
            profile={visibleProfile}
            friends={friends}
            isConnected={isConnected}
            canViewProfile={canViewProfile}
            isOwnProfile={isOwnProfile}
            isCoverUploading={isCoverUploading}
            onMessage={onMessage}
            onBack={onBack}
            onEditCover={onEditCover}
            onFriendSelect={onFriendSelect}
            onSendFriendRequest={onSendFriendRequest}
            sendingFriendIds={sendingFriendIds}
          />
          {restricted ? (
            <RestrictedProfile profile={profile} />
          ) : (
            <>
              <ProfileTimelineSoundControl />
              <div className="profile-nav-layout">
                <div className="profile-nav-wall" data-testid="region-profile-timeline">
                  {friendWall}
                </div>
                <aside className="profile-nav-rail" aria-label={`${profile.full_name} profile details`}>
                  <HooksSection posts={hooks} />
                  <ImagePostsSection posts={imagePosts} />
                  <MediaGallery
                    media={media}
                    hasMoreMedia={hasMoreMedia}
                    isLoadingMoreMedia={isLoadingMoreMedia}
                    onLoadMoreMedia={onLoadMoreMedia}
                  />
                  <FriendsList
                    friends={friends}
                    onFriendSelect={onFriendSelect}
                    onSendFriendRequest={onSendFriendRequest}
                    sendingFriendIds={sendingFriendIds}
                  />
                </aside>
              </div>
            </>
          )}
        </div>
      </main>
    </ProfileTimelineAudioProvider>
  );
}

export function QuickProfileModal({
  profile,
  isConnected,
  canViewProfile = isConnected,
  blocked = false,
  state = "ready",
  errorMessage,
  onClose,
  onMessage,
}: QuickProfileModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (state === "loading") {
    return (
      <div className="profile-nav profile-nav-modal-backdrop" role="presentation">
        <section className="profile-nav-modal" role="dialog" aria-modal="true" aria-label="Loading profile">
          <button className="profile-nav-modal-close" type="button" aria-label="Close quick profile" onClick={onClose}>
            <X size={17} aria-hidden="true" />
          </button>
          <div className="profile-nav-modal-content">
            <div className="profile-nav-modal-status" role="status" aria-live="polite">
              <span className="profile-nav-skeleton-circle" />
              <p>Loading profile…</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (state === "error" || (!profile && !blocked)) {
    return (
      <div className="profile-nav profile-nav-modal-backdrop" role="presentation">
        <section className="profile-nav-modal" role="dialog" aria-modal="true" aria-label="Profile unavailable">
          <button className="profile-nav-modal-close" type="button" aria-label="Close quick profile" onClick={onClose}>
            <X size={17} aria-hidden="true" />
          </button>
          <div className="profile-nav-modal-content">
            <div className="profile-nav-modal-status" role="alert">
              <LockKeyhole size={17} aria-hidden="true" />
              <p>
                <strong>Profile unavailable</strong>
                {errorMessage || "This profile can’t be viewed right now."}
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!profile) return null;

  const restricted =
    (profile.profile_locked === true && !isConnected) ||
    (profile.is_private_mode === true && !canViewProfile);
  const accessLabel = profile.is_private_mode ? "Private mode" : "Profile locked";
  const visibleProfile = restricted
    ? { ...profile, bio: null, location: null, school: null }
    : profile;

  return (
    <div
      className="profile-nav profile-nav-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="profile-nav-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${profile.full_name} quick profile`}
        data-testid="modal-quick-profile"
      >
        <button
          className="profile-nav-modal-close"
          type="button"
          aria-label="Close quick profile"
          onClick={onClose}
          data-testid="button-close-quick-profile"
        >
          <X size={17} aria-hidden="true" />
        </button>
        <div className="profile-nav-modal-content">
          {blocked ? (
            <div className="profile-nav-modal-status" role="status" data-testid="status-quick-profile-blocked">
              <LockKeyhole size={17} aria-hidden="true" />
              <p>
                <strong>Profile unavailable</strong>
                This profile can’t be viewed.
              </p>
            </div>
          ) : (
            <>
              <ProfileIdentity profile={visibleProfile} avatarVariant="hero" centered />
              {restricted && (
                <div className="profile-nav-modal-status" role="status" data-testid="status-quick-profile-private">
                  {profile.is_private_mode
                    ? <ShieldCheck size={17} aria-hidden="true" />
                    : <LockKeyhole size={17} aria-hidden="true" />}
                  <p>
                    <strong>{accessLabel}</strong>
                    {profile.is_private_mode
                      ? "Messaging and profile details are available to friends only."
                      : "This member’s profile details are visible to friends only."}
                  </p>
                </div>
              )}
              {isConnected && onMessage && (
                <button
                  className="profile-nav-action"
                  type="button"
                  onClick={() => onMessage(profile)}
                  data-testid="button-quick-profile-message"
                >
                  <MessageCircle size={16} aria-hidden="true" />
                  Message
                </button>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
