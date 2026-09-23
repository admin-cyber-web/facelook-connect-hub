import { supabase } from "./supabaseClient";

type SupabaseChannel = ReturnType<typeof supabase.channel>;

interface VisibleChannelOptions {
  /**
   * Runs only when a previously hidden document becomes visible again.
   * Use this to refresh the small amount of state missed while disconnected.
   */
  onVisible?: () => void;
}

/**
 * Keeps a realtime channel disconnected while the document is backgrounded.
 *
 * Supabase will otherwise keep the WebSocket and postgres change listeners
 * alive in a hidden mobile WebView. Reconnecting on resume is intentional:
 * callers can use onVisible to rehydrate state that changed while hidden.
 */
export function subscribeWhileVisible(
  createChannel: () => SupabaseChannel,
  options: VisibleChannelOptions = {},
): () => void {
  let channel: SupabaseChannel | null = null;
  let disposed = false;
  let wasHidden = document.visibilityState === "hidden";

  const connect = () => {
    if (disposed || channel || document.visibilityState === "hidden") return;
    channel = createChannel();
  };

  const disconnect = () => {
    if (!channel) return;
    const current = channel;
    channel = null;
    void supabase.removeChannel(current);
  };

  const handleVisibilityChange = () => {
    const hidden = document.visibilityState === "hidden";
    if (hidden) {
      disconnect();
    } else {
      connect();
      if (wasHidden) options.onVisible?.();
    }
    wasHidden = hidden;
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  if (!wasHidden) connect();

  return () => {
    disposed = true;
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    disconnect();
  };
}