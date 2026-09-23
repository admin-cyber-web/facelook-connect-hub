import { supabase } from "@/lib/supabaseClient";

export interface SearchableProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  fame_points?: number | null;
  last_seen?: string | null;
  is_private_mode?: boolean;
}

/**
 * Search profiles through the privacy-aware RPC.
 *
 * Search is intentionally RPC-only. If the function is unavailable, return
 * no results rather than falling back to a direct profiles-table query.
 */
export async function searchVisibleProfiles(
  query: string,
  limit: number,
): Promise<{ data: SearchableProfile[]; error: unknown }> {
  const { data, error } = await supabase.rpc("search_visible_profiles", {
    p_query: query.trim(),
    p_limit: limit,
  });

  if (!error) {
    return { data: (data || []) as SearchableProfile[], error: null };
  }

  return { data: [], error };
}

/**
 * Re-checks access before opening a chat or sending to a private profile.
 * A missing RPC fails closed for private profiles.
 */
export async function canViewPrivateProfile(
  targetUserId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("can_view_private_profile", {
    p_target_user_id: targetUserId,
  });
  return !error && data === true;
}