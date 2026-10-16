import type { ReactNode } from "react";

export type ProfileNavigationProfile = {
  id: string;
  full_name: string;
  username?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  location?: string | null;
  school?: string | null;
  profile_locked?: boolean | null;
  is_private_mode?: boolean | null;
};

export type ProfileNavigationFriend = {
  id: string;
  full_name: string;
  avatar_url?: string | null;
};

export type ProfileNavigationMedia = {
  id: string;
  url: string;
  preview_url?: string | null;
  media_type?: string | null;
  created_at?: string | null;
};

export type ProfileViewState = "loading" | "ready" | "error";

export type FullProfilePageProps = {
  profile: ProfileNavigationProfile | null;
  friendWall: ReactNode;
  media: ProfileNavigationMedia[];
  friends: ProfileNavigationFriend[];
  isConnected: boolean;
  canViewProfile?: boolean;
  state?: ProfileViewState;
  errorMessage?: string;
  hasMoreMedia?: boolean;
  isLoadingMoreMedia?: boolean;
  onRetry?: () => void;
  onLoadMoreMedia?: () => void;
  onMessage?: (profile: ProfileNavigationProfile) => void;
  onFriendSelect?: (friend: ProfileNavigationFriend) => void;
  onBack?: () => void;
};

export type QuickProfileModalProps = {
  profile: ProfileNavigationProfile | null;
  isConnected: boolean;
  canViewProfile?: boolean;
  blocked?: boolean;
  state?: ProfileViewState;
  errorMessage?: string;
  onClose: () => void;
  onMessage?: (profile: ProfileNavigationProfile) => void;
};
