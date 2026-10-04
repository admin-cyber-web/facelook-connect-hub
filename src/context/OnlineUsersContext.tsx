import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabaseClient";
import { subscribeWhileVisible } from "@/lib/realtimeVisibility";

interface OnlineUsersContextValue {
  onlineIds: Set<string>;
  activeHide: boolean;
}

const OnlineUsersCtx = createContext<OnlineUsersContextValue>({
  onlineIds: new Set(),
  activeHide: true,
});

interface Props {
  userId: string | null | undefined;
  children: ReactNode;
}

const ACTIVE_HIDE_EVENT = "flicks:active-hide-changed";
const ACTIVE_IDLE_MS = 2 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 60 * 1000;

export function OnlineUsersProvider({ userId, children }: Props) {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [activeHide, setActiveHide] = useState<boolean | null>(null);
  const activeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!userId) {
      setActiveHide(true);
      setOnlineIds(new Set());
      return;
    }

    let cancelled = false;
    const loadActiveHide = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("active_hide")
        .eq("id", userId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.error("[presence] Unable to load active-hide preference:", error.message);
        setActiveHide(true);
        window.dispatchEvent(new CustomEvent(ACTIVE_HIDE_EVENT, { detail: true }));
        return;
      }
      const nextValue = data?.active_hide === true;
      setActiveHide(nextValue);
      window.dispatchEvent(new CustomEvent(ACTIVE_HIDE_EVENT, { detail: nextValue }));
    };

    void loadActiveHide();

    const handlePreferenceChange = (event: Event) => {
      const nextValue = (event as CustomEvent<boolean>).detail;
      if (typeof nextValue === "boolean") setActiveHide(nextValue);
    };
    window.addEventListener(ACTIVE_HIDE_EVENT, handlePreferenceChange);
    const preferenceChannel = "BroadcastChannel" in window
      ? new BroadcastChannel("flicks-active-hide")
      : null;
    if (preferenceChannel) {
      preferenceChannel.onmessage = (event: MessageEvent<unknown>) => {
        if (typeof event.data === "boolean") {
          setActiveHide(event.data);
          window.dispatchEvent(new CustomEvent(ACTIVE_HIDE_EVENT, { detail: event.data }));
        }
      };
    }

    const refreshPreferenceOnResume = () => {
      if (document.visibilityState === "visible") void loadActiveHide();
    };
    document.addEventListener("visibilitychange", refreshPreferenceOnResume);
    const stopPreferenceSubscription = subscribeWhileVisible(() => {
      const channel = supabase
        .channel(`active-hide-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${userId}`,
          },
          (payload) => {
            const profileUpdate = payload.new as { active_hide?: unknown };
            if (typeof profileUpdate.active_hide !== "boolean") return;
            const nextValue = profileUpdate.active_hide;
            setActiveHide(nextValue);
            window.dispatchEvent(new CustomEvent(ACTIVE_HIDE_EVENT, { detail: nextValue }));
          },
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error(`[presence] Active Hide realtime subscription failed: ${status}`);
          }
        });
      return channel;
    });

    return () => {
      cancelled = true;
      window.removeEventListener(ACTIVE_HIDE_EVENT, handlePreferenceChange);
      document.removeEventListener("visibilitychange", refreshPreferenceOnResume);
      stopPreferenceSubscription();
      preferenceChannel?.close();
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setOnlineIds(new Set());
      return;
    }

    let active = false;
    let lastSeenWriteAt = 0;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const activityEvents = ["pointerdown", "keydown", "touchstart", "mousemove"] as const;

    const stopTracking = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = null;
      if (!active) return;
      active = false;
      void activeChannelRef.current?.untrack().catch((error: unknown) => {
        console.error("[presence] Unable to stop presence tracking:", error);
      });
    };

    const markActive = () => {
      const channel = activeChannelRef.current;
      if (!channel || document.visibilityState !== "visible") return;
      if (activeHide === null) return;
      if (activeHide === false && !active) {
        active = true;
        void channel.track({ userId }).catch((error: unknown) => {
          active = false;
          console.error("[presence] Unable to publish active presence:", error);
        });
      }

      const now = Date.now();
      if (activeHide === false && now - lastSeenWriteAt >= HEARTBEAT_INTERVAL_MS) {
        lastSeenWriteAt = now;
        void supabase
          .from("profiles")
          .update({ last_seen: new Date(now).toISOString() })
          .eq("id", userId)
          .then(({ error }) => {
            if (error) {
              console.error("[presence] Unable to update last_seen:", error.message);
            }
          });
      }

      if (activeHide === false) {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(stopTracking, ACTIVE_IDLE_MS);
      }
    };

    const cleanup = subscribeWhileVisible(() => {
      const channel = supabase.channel("online-users", {
        config: { presence: { key: userId } },
      });
      activeChannelRef.current = channel;

      channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ userId: string }>();
        const ids = new Set(
          Object.values(state)
            .flat()
            .map((presence) => presence.userId)
            .filter((id): id is string => Boolean(id)),
        );
        setOnlineIds(ids);
      });

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") markActive();
      });

      return channel;
    }, {
      onVisible: () => {
        setOnlineIds(new Set());
      },
    });
    activityEvents.forEach((event) => {
      window.addEventListener(event, markActive, { passive: true });
    });
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      activeChannelRef.current = null;
      active = false;
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = null;
      setOnlineIds(new Set());
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cleanup();
      activityEvents.forEach((event) => {
        window.removeEventListener(event, markActive);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      activeChannelRef.current = null;
      if (idleTimer) clearTimeout(idleTimer);
      setOnlineIds(new Set());
    };
  }, [userId, activeHide]);

  return (
    <OnlineUsersCtx.Provider value={{ onlineIds, activeHide: activeHide !== false }}>
      {children}
    </OnlineUsersCtx.Provider>
  );
}

/** Returns IDs with a live, recent Realtime Presence connection. */
export function useOnlineUsers(): Set<string> {
  return useContext(OnlineUsersCtx).onlineIds;
}

/** Returns true while the signed-in user's Active Hide preference is enabled or loading. */
export function useActiveHide(): boolean {
  return useContext(OnlineUsersCtx).activeHide;
}

/** Convenience: is a specific user ID currently online? */
export function useIsOnline(userId: string | null | undefined): boolean {
  const ids = useOnlineUsers();
  return Boolean(userId && ids.has(userId));
}
