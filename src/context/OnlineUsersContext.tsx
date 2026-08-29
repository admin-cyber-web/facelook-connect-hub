import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabaseClient";
import { usePageVisibility } from "@/hooks/usePageVisibility";

// ── Context value ─────────────────────────────────────────────────────────────
const OnlineUsersCtx = createContext<Set<string>>(new Set());

// ── Provider ──────────────────────────────────────────────────────────────────
interface Props {
  userId: string | null | undefined;
  children: ReactNode;
}

export function OnlineUsersProvider({ userId, children }: Props) {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pageVisible = usePageVisibility();

  useEffect(() => {
    if (!userId || !pageVisible) {
      setOnlineIds(new Set());
      return;
    }

    const ch = supabase.channel("online-users", {
      config: { presence: { key: userId } },
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<{ userId: string }>();
      const ids = new Set<string>(
        Object.values(state).flatMap((arr: any[]) =>
          arr.map((p: any) => p.userId).filter(Boolean)
        )
      );
      setOnlineIds(ids);
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ userId, online_at: new Date().toISOString() });
      }
    });

    channelRef.current = ch;

    return () => {
      ch.untrack().finally(() => {
        supabase.removeChannel(ch);
      });
      channelRef.current = null;
    };
  }, [userId, pageVisible]);

  return (
    <OnlineUsersCtx.Provider value={onlineIds}>
      {children}
    </OnlineUsersCtx.Provider>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────
/** Returns the full Set of currently-online user IDs. */
export function useOnlineUsers(): Set<string> {
  return useContext(OnlineUsersCtx);
}

/** Convenience: is a specific user ID currently online? */
export function useIsOnline(userId: string | null | undefined): boolean {
  const ids = useContext(OnlineUsersCtx);
  return !!userId && ids.has(userId);
}
