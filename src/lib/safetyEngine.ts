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
export const RISK_INCREMENT  = 10; // points per risky message

// ── Keyword checks ────────────────────────────────────────────────────────────

/** Returns true if text contains any risk keyword (case-insensitive substring). */
export function hasRiskKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return RISK_KEYWORDS.some((kw) => lower.includes(kw));
}

/** Returns true if text contains any romantic/intimate keyword. */
export function hasLoveKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return LOVE_KEYWORDS.some((kw) => lower.includes(kw));
}

// ── Risk score management ─────────────────────────────────────────────────────

/**
 * Increment the sender's risk score by RISK_INCREMENT.
 * If the new score exceeds RISK_THRESHOLD, is_flagged is set to true.
 * Returns the new score, or 0 on failure.
 */
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

/**
 * Fetch the risk profile for a user.
 * Returns null if the profile doesn't exist yet (user has no risk events).
 */
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

/**
 * Insert a privacy-conscious system notification for a user.
 * Does NOT include any message content — only the alert type and a generic message.
 */
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
    // Non-critical — don't surface errors to the user
  }
}

// ── Love Protect violation check ──────────────────────────────────────────────

/**
 * Check whether the given partner has sent romantic/intimate messages
 * to 2 or more distinct users in the past hour.
 * Returns true if a violation is detected.
 * Note: This only checks messages where the current user can see sender/receiver
 * (i.e. messages table rows involving the current viewer).
 * A full backend check would require a privileged service-role function.
 */
export async function checkLoveProtectViolation(partnerId: string): Promise<boolean> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: recent } = await supabase
      .from("messages")
      .select("receiver_id, content")
      .eq("sender_id", partnerId)
      .gte("created_at", oneHourAgo);

    if (!recent || recent.length === 0) return false;

    const loveMessages = (recent as { receiver_id: string; content: string }[]).filter(
      (m) => hasLoveKeyword(m.content || "")
    );

    const uniqueReceivers = new Set(loveMessages.map((m) => m.receiver_id));
    // Flag if partner sent love messages to 2 or more different people in 1 hour
    return uniqueReceivers.size >= 2;
  } catch {
    return false;
  }
}
