export type StickerType =
  | "love"
  | "morning"
  | "afternoon"
  | "evening"
  | "night"
  | "hot_weather"
  | "cold_weather"
  | "rain"
  | "anniversary"
  | "father_day"
  | "mother_day"
  | "diwali"
  | "holi"
  | "holiday"
  | "see_you_tomorrow"
  | "waiting"
  | "sleep_wake"
  | "warning"
  | null;

export interface ParseResult {
  sticker: StickerType;
  originalText: string;
}

/**
 * KEYWORD MAP — add new groups or new phrases freely.
 * Each key is a StickerType, value is a list of trigger phrases (lowercase).
 * Matching is substring-based so "good morning bhai" also triggers "morning".
 */
const KEYWORD_MAP: Record<NonNullable<StickerType>, string[]> = {
  // ── Love / Affection ───────────────────────────────────────────────────────
  love: [
    "i lov u",
    "i love u",
    "i love you",
    "love u",
    "love you",
    "luv u",
    "luv you",
    "i kiss u",
    "kiss u",
    "kiss you",
    "i miss u",
    "i miss you",
    "miss u",
    "hug u",
    "hug you",
    "i hug you",
    "i wait u",
    "tum mere dil me ho",
    "aap bahut achi ho",
    "aap bahut achhi ho",
  ],

  // ── Greetings ──────────────────────────────────────────────────────────────
  morning:   ["good morning"],
  afternoon: ["good afternoon"],
  evening:   ["good evening"],
  night:     ["good night"],

  // ── Weather / Daily ────────────────────────────────────────────────────────
  hot_weather:  ["aaj bahut garmi hai"],
  cold_weather: ["aaj bahut thandi hai", "aaj bahuy shardi hai"],
  rain:         ["bahut tez barish aayegi", "bahut jor ki barish", "barish"],

  // ── Special Days ───────────────────────────────────────────────────────────
  anniversary:      ["happy aniversery", "happy anniversary"],
  father_day:       ["father day"],
  mother_day:       ["mother day"],
  diwali:           ["happy diwali"],
  holi:             ["happy holi"],
  holiday:          ["aaj chutti hai"],
  see_you_tomorrow: ["mai kal milunga", "see you tommorow", "see you tomorrow", "kal milna", "kal miloge"],

  // ── Waiting (NEW) ──────────────────────────────────────────────────────────
  waiting: [
    "waiting u",
    "waiting you",
    "i am waiting",
    "wait kar raha",
    "wait kar rhi",
    "wait kar rhe",
    "kab aaoge",
    "kab aaogi",
    "kab aoge",
    "kab aogi",
    "kab ayoge",
    "kab ayogi",
  ],

  // ── Sleep / Wake (NEW) ─────────────────────────────────────────────────────
  sleep_wake: [
    "uth jao",
    "so rhe ho kya",
    "so rahe ho kya",
    "kab so kar uthe",
    "chalo ab so jao",
    "so gaye kya",
    "so gyi kya",
    "neend aa rhi",
    "neend aa raha",
  ],

  // ── Warning (aggressive language) — shows a warning badge, not an animation
  warning: ["i fuck u", "mai tujhe dekh lunga"],
};

/**
 * Parse a chat message and return the matching sticker type.
 * Returns { sticker: null } when no keyword matches (render normally).
 * Priority: "warning" is checked first so it can never be masked by another match.
 */
export function parseMessage(text: string): ParseResult {
  const lower = text.trim().toLowerCase();

  // Always check warning first
  for (const kw of KEYWORD_MAP.warning) {
    if (lower.includes(kw)) {
      return { sticker: "warning", originalText: text };
    }
  }

  // Check all other groups in declaration order
  for (const [type, keywords] of Object.entries(KEYWORD_MAP)) {
    if (type === "warning") continue;
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        return { sticker: type as NonNullable<StickerType>, originalText: text };
      }
    }
  }

  return { sticker: null, originalText: text };
}

/**
 * Utility: returns the matched StickerType effect for a message text, or null.
 * Use this on both sender and receiver side to keep effects in sync.
 * Case-insensitive, substring-based.
 */
export function getEffectForMessage(text: string): NonNullable<StickerType> | null {
  return parseMessage(text).sticker;
}
