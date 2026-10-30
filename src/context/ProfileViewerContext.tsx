import React, { createContext, useContext, useState, useCallback, lazy, Suspense } from "react";

// Keep avatar taps lightweight and separate from the full timeline route.
const UserProfilePreview = lazy(
  () => import("../components/UserProfilePreviewModal"),
);

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

  const openProfile = useCallback((userId: string) => {
    if (userId && userId !== "") setViewingId(userId);
  }, []);

  return (
    <ProfileViewerContext.Provider value={{ openProfile }}>
      {children}
      <Suspense fallback={null}>
        {viewingId && (
          <UserProfilePreview
            key={viewingId}
            userId={viewingId}
            currentUserId={currentUserId}
            onClose={() => setViewingId(null)}
          />
        )}
      </Suspense>
    </ProfileViewerContext.Provider>
  );
};
