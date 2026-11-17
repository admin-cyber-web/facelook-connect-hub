// OneSignal push subscription registration
// Call registerPushPlayer(userId) after a user successfully logs in.
// It gets the OneSignal subscription ID and saves it to profiles.onesignal_player_id.

import { supabase } from "@/lib/supabaseClient";

declare global {
  interface Window {
    OneSignalDeferred?: Array<(os: any) => void | Promise<void>>;
    Capacitor?: { isNativePlatform?: () => boolean };
  }
}

const PUSH_HOSTS = ["flicksindia.online", "www.flicksindia.online"];

/**
 * Web push only works on the production domain. The native shell has no push
 * plugin installed yet, so it is skipped there instead of silently failing.
 */
export function isPushEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  if (window.Capacitor?.isNativePlatform?.()) return false;
  return PUSH_HOSTS.includes(window.location.hostname);
}

/**
 * Registers the current browser's OneSignal subscription ID
 * to the user's profile row so the backend can target them.
 * Safe to call on every login — no-ops if already registered or not subscribed.
 */
export async function registerPushPlayer(userId: string): Promise<void> {
  if (!isPushEnvironment()) return;

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    try {
      // Request permission if not yet granted
      const permission = await OneSignal.Notifications.permission;
      if (!permission) {
        await OneSignal.Notifications.requestPermission();
      }

      // Get the subscription ID for this browser
      const subscriptionId: string | null =
        await OneSignal.User.PushSubscription.id;

      if (!subscriptionId) return; // user denied or not supported

      // Save to Supabase profile (upsert — safe to call repeatedly)
      const { error } = await supabase
        .from("profiles")
        .update({ onesignal_player_id: subscriptionId })
        .eq("id", userId);

      if (error) {
        console.warn("[push] Failed to save player ID:", error.message);
      } else {
        console.log("[push] Player ID registered:", subscriptionId);
      }
    } catch (err) {
      console.warn("[push] registerPushPlayer error:", err);
    }
  });
}
