// OneSignal push subscription registration
// Call registerPushPlayer(userId) after a user successfully logs in.
// It gets the OneSignal subscription ID and saves it to profiles.onesignal_player_id.

import { supabase } from "@/lib/supabaseClient";

declare global {
  interface Window {
    OneSignalDeferred?: Array<(os: any) => void | Promise<void>>;
  }
}

/**
 * Registers the current browser's OneSignal subscription ID
 * to the user's profile row so the backend can target them.
 * Safe to call on every login — no-ops if already registered or not subscribed.
 */
export async function registerPushPlayer(userId: string): Promise<void> {
  // Only runs on the production domain where OneSignal is initialised
  if (typeof window === "undefined" || window.location.hostname !== "flicksindia.online") return;

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
