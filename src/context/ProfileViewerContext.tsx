import React, { createContext, useContext, useState, useCallback } from "react";
import UserProfileModal from "../components/UserProfileModal";

interface ProfileViewerCtx {
  openProfile: (userId: string) => void;
}

const ProfileViewerContext = createContext<ProfileViewerCtx>({ openProfile: () => {} });

export const useProfileViewer = () => useContext(ProfileViewerContext);

export const ProfileViewerProvider = ({ children, currentUserId }: { children: React.ReactNode; currentUserId: string }) => {
  const [viewingId, setViewingId] = useState<string | null>(null);

  const openProfile = useCallback((userId: string) => {
    if (userId && userId !== "") setViewingId(userId);
  }, []);

  return (
    <ProfileViewerContext.Provider value={{ openProfile }}>
      {children}
      {viewingId && (
        <UserProfileModal
          userId={viewingId}
          currentUserId={currentUserId}
          onClose={() => setViewingId(null)}
        />
      )}
    </ProfileViewerContext.Provider>
  );
};
