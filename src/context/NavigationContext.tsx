import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

interface NavigationContextValue {
  /** Pending post ID to navigate to when FameFeed mounts */
  pendingPostId: string | null;
  /** Whether to expand comments when navigating to the post */
  pendingExpandComments: boolean;
  /** Set a pending post navigation - call this from anywhere */
  navigateToPost: (postId: string, expandComments?: boolean) => void;
  /** Clear the pending navigation (called by FameFeed after handling) */
  clearPendingPost: () => void;
  /** Current active feature - synced with Index.tsx activeFeature */
  activeFeature: string;
  /** Set active feature */
  setActiveFeature: (feature: string) => void;
}

const NavigationCtx = createContext<NavigationContextValue | null>(null);

interface Props {
  children: ReactNode;
  /** Initial active feature from parent (Index.tsx) */
  initialActiveFeature?: string;
  /** Callback when active feature changes externally */
  onActiveFeatureChange?: (feature: string) => void;
}

export function NavigationProvider({ 
  children, 
  initialActiveFeature = "Fame",
  onActiveFeatureChange 
}: Props) {
  const [pendingPostId, setPendingPostId] = useState<string | null>(null);
  const [pendingExpandComments, setPendingExpandComments] = useState(false);
  const [activeFeature, setActiveFeature] = useState(initialActiveFeature);

  // Sync with parent when it changes
  useEffect(() => {
    setActiveFeature(initialActiveFeature);
  }, [initialActiveFeature]);

  const navigateToPost = useCallback((postId: string, expandComments = false) => {
    setPendingPostId(postId);
    setPendingExpandComments(expandComments);
    // If not on Fame feature, switch to Fame feature
    if (activeFeature !== "Fame") {
      setActiveFeature("Fame");
      onActiveFeatureChange?.("Fame");
    }
  }, [activeFeature, onActiveFeatureChange]);

  const handleSetActiveFeature = useCallback((feature: string) => {
    setActiveFeature(feature);
    onActiveFeatureChange?.(feature);
  }, [onActiveFeatureChange]);

  const clearPendingPost = useCallback(() => {
    setPendingPostId(null);
    setPendingExpandComments(false);
  }, []);

  return (
    <NavigationCtx.Provider
      value={{
        pendingPostId,
        pendingExpandComments,
        navigateToPost,
        clearPendingPost,
        activeFeature,
        setActiveFeature: handleSetActiveFeature,
      }}
    >
      {children}
    </NavigationCtx.Provider>
  );
}

export function useNavigation() {
  const ctx = useContext(NavigationCtx);
  if (!ctx) {
    throw new Error("useNavigation must be used within a NavigationProvider");
  }
  return ctx;
}