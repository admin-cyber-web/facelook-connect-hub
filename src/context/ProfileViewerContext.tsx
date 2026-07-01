import React, { createContext, useContext, useState, useCallback, lazy, Suspense } from "react";
import { isAdminEmail } from "../lib/adminConfig";

// Lazy import breaks the circular dependency:
// UserProfileModal → useProfileViewer → ProfileViewerContext → UserProfileModal
const UserProfileModal = lazy(() => import("../components/UserProfileModal"));

interface ProfileViewerCtx {
  openProfile: (userId: string) => void;
}

const ProfileViewerContext = createContext<ProfileViewerCtx>({ openProfile: () => {} });

export const useProfileViewer = () => useContext(ProfileViewerContext);

export const ProfileViewerProvider = ({
  children,
  currentUserId,
  currentUserEmail,
}: {
  children: React.ReactNode;
  currentUserId: string;
  currentUserEmail?: string;
}) => {
  const [viewingId, setViewingId] = useState<string | null>(null);
  const isAdmin = isAdminEmail(currentUserEmail || "");

  const openProfile = useCallback((userId: string) => {
    if (userId && userId !== "") setViewingId(userId);
  }, []);

  return (
    <ProfileViewerContext.Provider value={{ openProfile }}>
      {children}
      <Suspense fallback={null}>
        {viewingId && (
          <UserProfileModal
            userId={viewingId}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onClose={() => setViewingId(null)}
          />
        )}
      </Suspense>
    </ProfileViewerContext.Provider>
  );
};
