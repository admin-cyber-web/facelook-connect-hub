import { supabase } from "./supabaseClient";

export async function fetchProfileAdminFlag(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.is_admin === true;
}