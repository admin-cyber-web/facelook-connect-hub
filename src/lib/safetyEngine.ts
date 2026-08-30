/**
 * Safety & Integrity Engine — utility functions
 * All DB operations go through Supabase; results are stored server-side.
 */
import { supabase } from "./supabaseClient";

// ── Risk keyword list (English + Hinglish) ────────────────────────────────────
export const RISK_KEYWORDS: string[] = [
  // Financial coercion
  "paise", "paisa", "account number", "gpay", "paytm", "phonepe",
  "bank account", "upi id", "transfer karo", "paise bhejo",
  // Threats / violence
  "threat", "murder", "kill you", "kill u",
  "jaan se marunga", "jaan se marungi", "maar dunga", "maar dungi",
  "jaan le lunga", "jaan le lungi", "khoon", "bomb",
  "kidnap", "blackmail", "extortion",
  // Explicit harassment
  "nude", "nudes", "send nudes", "naked photo",
  "rape", "molest",
];

// ── Romantic / intimate keywords (for Love Protect monitoring) ────────────────
export const LOVE_KEYWORDS: string[] = [
  "i love u", "i love you", "love u", "love you",
  "kiss u", "kiss you", "i kiss u",
  "hug u", "hug you", "i hug u",
  "sex", "sexy", "intimate", "baby i",
  "jaan", "jaan meri", "darling", "sweetheart",
  "miss u", "miss you", "i miss u",
];

export const RISK_THRESHOLD = 50;
export const RISK_INCREMENT  = 10;

// ── Keyword checks ────────────────────────────────────────────────────────────

export function hasRiskKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return RISK_KEYWORDS.some((kw) => lower.includes(kw));
}

export function hasLoveKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return LOVE_KEYWORDS.some((kw) => lower.includes(kw));
}

// ── Risk score management ─────────────────────────────────────────────────────

export async function incrementRiskScore(userId: string): Promise<number> {
  try {
    const { data: existing } = await supabase
      .from("user_risk_profiles")
      .select("risk_score")
      .eq("user_id", userId)
      .maybeSingle();

    const current  = (existing as { risk_score: number } | null)?.risk_score ?? 0;
    const newScore = current + RISK_INCREMENT;
    const flagged  = newScore > RISK_THRESHOLD;

    await supabase.from("user_risk_profiles").upsert(
      { user_id: userId, risk_score: newScore, is_flagged: flagged, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

    return newScore;
  } catch {
    return 0;
  }
}

export async function getRiskProfile(
  userId: string
): Promise<{ risk_score: number; is_flagged: boolean } | null> {
  try {
    const { data } = await supabase
      .from("user_risk_profiles")
      .select("risk_score, is_flagged")
      .eq("user_id", userId)
      .maybeSingle();
    return (data as { risk_score: number; is_flagged: boolean } | null) ?? null;
  } catch {
    return null;
  }
}

// ── Safety notifications ──────────────────────────────────────────────────────

export async function sendSafetyNotification(
  userId: string,
  type: "suspicious_activity" | "love_protect",
  message: string
): Promise<void> {
  try {
    await supabase
      .from("safety_notifications")
      .insert({ user_id: userId, type, message });
  } catch {
    // Non-critical
  }
}

// ── Love Protect violation check ──────────────────────────────────────────────
/**
 * Detects suspicious partner activity using messages visible to the current user.
 *
 * STRATEGY (client-side, RLS-safe):
 *   Query messages sent BY the partner that are visible to us (i.e. sent to us).
 *   A violation fires when partner sent 2+ messages in the last 5 minutes — this
 *   indicates active rapid messaging behaviour. The alert is intentionally broad;
 *   a proper server-side Edge Function would give cross-conversation visibility.
 *
 * Returns true  → show alert.
 * Returns false → no alert.
 */
export async function checkLoveProtectViolation(partnerId: string): Promise<boolean> {
  console.log("[LoveProtect] checkLoveProtectViolation called for partnerId:", partnerId);

  try {
    // Window: last 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: recent, error } = await supabase
      .from("messages")
      .select("id, created_at, content")
      .eq("sender_id", partnerId)
      .gte("created_at", fiveMinAgo)
      .order("created_at", { ascending: false });

    console.log("[LoveProtect] DB result — rows:", recent?.length ?? 0, "error:", error?.message ?? "none");

    if (error) {
      console.warn("[LoveProtect] Supabase error:", error.message);
      return false;
    }

    if (!recent || recent.length === 0) {
      console.log("[LoveProtect] No recent messages from partner — no violation.");
      return false;
    }

    // Violation: partner sent 2 or more messages in the last 5 minutes
    const violated = recent.length >= 2;
    console.log(
      `[LoveProtect] ${recent.length} messages in last 5 min — violated=${violated}`
    );
    return violated;
  } catch (ex) {
    console.error("[LoveProtect] Unexpected error:", ex);
    return false;
  }
}
