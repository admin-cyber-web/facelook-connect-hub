import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { canViewPrivateProfile } from "@/lib/profileSearch";
import {
  QuickProfileModal as QuickProfilePresentation,
  type ProfileNavigationProfile,
  type ProfileViewState,
} from "@/components/profile-navigation";

interface Props {
  userId: string;
  currentUserId: string;
  onClose: () => void;
}

type FriendStatusRow = {
  status: "none" | "pending" | "accepted";
};

export default function QuickProfileDetailsModal({
  userId,
  currentUserId,
  onClose,
}: Props) {
  const [profile, setProfile] = useState<ProfileNavigationProfile | null>(null);
  const [state, setState] = useState<ProfileViewState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isConnected, setIsConnected] = useState(false);
  const [canViewProfile, setCanViewProfile] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let active = true;
    setProfile(null);
    setState("loading");
    setErrorMessage(undefined);
    setIsConnected(false);
    setCanViewProfile(false);
    setBlocked(false);

    const load = async () => {
      const isOwnProfile = userId === currentUserId;
      const [profileResult, friendshipResult, blockResult] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id,full_name,username,avatar_url,bio,location,school,profile_locked,is_private_mode",
          )
          .eq("id", userId)
          .maybeSingle(),
        !isOwnProfile && currentUserId
          ? supabase
              .from("friendships")
              .select("status")
              .or(
                `and(sender_id.eq.${currentUserId},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUserId})`,
              )
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        !isOwnProfile && currentUserId
          ? supabase
              .from("user_blocks")
              .select("blocked_id")
              .eq("blocker_id", currentUserId)
              .eq("blocked_id", userId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (!active) return;
      if (profileResult.error || !profileResult.data) {
        setErrorMessage("This profile isn’t available.");
        setState("error");
        return;
      }

      const profileData = profileResult.data;
      const friendship = friendshipResult.data as FriendStatusRow | null;
      const connected = isOwnProfile || friendship?.status === "accepted";
      const isBlocked = !isOwnProfile && !!blockResult.data;
      let privateAccess = true;
      if (profileData.is_private_mode === true && !connected && !isBlocked) {
        privateAccess = await canViewPrivateProfile(userId);
      }

      if (!active) return;
      setProfile({
        ...profileData,
        full_name: profileData.full_name || profileData.username || "Flicks member",
      });
      setIsConnected(connected);
      setCanViewProfile(privateAccess);
      setBlocked(isBlocked || (!isOwnProfile && !!blockResult.error));
      setState("ready");
    };

    void load().catch((error: unknown) => {
      console.error("[QuickProfileDetailsModal] profile load failed:", error);
      if (!active) return;
      setErrorMessage("Please try opening this profile again.");
      setState("error");
    });

    return () => {
      active = false;
    };
  }, [userId, currentUserId]);

  return (
    <QuickProfilePresentation
      profile={profile}
      state={state}
      errorMessage={errorMessage}
      isConnected={isConnected}
      canViewProfile={canViewProfile}
      blocked={blocked}
      onClose={onClose}
    />
  );
}
