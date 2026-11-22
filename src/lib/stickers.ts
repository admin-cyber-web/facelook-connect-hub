/**
 * Flat list of all 30 chat stickers hosted directly on BunnyCDN:
 * https://flicksindiacdn.b-cdn.net/Stickers/
 */

export const STICKER_BASE_URL = "https://flicksindiacdn.b-cdn.net/Stickers";

export const STICKER_FILENAMES: readonly string[] = [
  "angry stickers.webp",
  "angry stickers2.webp",
  "angry stickers3.webp",
  "angry stickers4.webp",
  "angry stickers5.webp",
  "angry stickers7.webp",
  "angry stickers8.webp",
  "emotional stickers.webp",
  "emotional stickers2.webp",
  "emotional stickers3.webp",
  "emotional stickers5.webp",
  "emotional stickers6.webp",
  "emotional stickers7.webp",
  "love stickers.webp",
  "love stickers2.webp",
  "love stickers 3.webp",
  "love stickers 4.webp",
  "love stickers 5.webp",
  "love stickers 6.webp",
  "love stickers 7.webp",
  "sad stickers.webp",
  "sad stickers 2.webp",
  "sad stickers3.webp",
  "sad stickers4.webp",
  "sad stickers5.webp",
  "sad stickers 6.webp",
  "sad stickers7.webp",
  "sad stickers78.webp",
  "sad stickers8.webp",
  "stickers-nounours i love gif.gif",
] as const;

export interface StickerItem {
  id: string;
  filename: string;
  url: string;
}

export function buildStickerUrl(filename: string): string {
  return `${STICKER_BASE_URL}/${encodeURIComponent(filename)}`;
}

export const CHAT_STICKERS: StickerItem[] = STICKER_FILENAMES.map((filename, index) => ({
  id: `sticker-${index + 1}`,
  filename,
  url: buildStickerUrl(filename),
}));

// ── Media type detection ────────────────────────────────────────────────────────
export function stickerMediaType(url: string): StickerType {
  const lower = url.toLowerCase();
  if (lower.includes("love")) return "love";
  if (lower.includes("morning")) return "morning";
  if (lower.includes("afternoon")) return "afternoon";
  if (lower.includes("evening")) return "evening";
  if (lower.includes("night")) return "night";
  if (lower.includes("hot_weather") || lower.includes("hot")) return "hot_weather";
  if (lower.includes("cold_weather") || lower.includes("cold")) return "cold_weather";
  if (lower.includes("rain")) return "rain";
  if (lower.includes("anniversary")) return "anniversary";
  if (lower.includes("father_day") || lower.includes("dad")) return "father_day";
  if (lower.includes("mother_day") || lower.includes("mom")) return "mother_day";
  if (lower.includes("diwali")) return "diwali";
  if (lower.includes("holi")) return "holi";
  if (lower.includes("holiday")) return "holiday";
  if (lower.includes("see_you_tomorrow")) return "see_you_tomorrow";
  if (lower.includes("waiting")) return "waiting";
  if (lower.includes("sleep_wake") || lower.includes("sleep") || lower.includes("wake")) return "sleep_wake";
  if (lower.includes("warning")) return "warning";
  return "love"; // default fallback
}

// ── Media type detection ────────────────────────────────────────────────────────
export function stickerMediaType(url: string): StickerType {
  const lower = url.toLowerCase();
  if (lower.includes("love")) return "love";
  if (lower.includes("morning")) return "morning";
  if (lower.includes("afternoon")) return "afternoon";
  if (lower.includes("evening")) return "evening";
  if (lower.includes("night")) return "night";
  if (lower.includes("hot_weather") || lower.includes("hot")) return "hot_weather";
  if (lower.includes("cold_weather") || lower.includes("cold")) return "cold_weather";
  if (lower.includes("rain")) return "rain";
  if (lower.includes("anniversary")) return "anniversary";
  if (lower.includes("father_day") || lower.includes("dad")) return "father_day";
  if (lower.includes("mother_day") || lower.includes("mom")) return "mother_day";
  if (lower.includes("diwali")) return "diwali";
  if (lower.includes("holi")) return "holi";
  if (lower.includes("holiday")) return "holiday";
  if (lower.includes("see_you_tomorrow")) return "see_you_tomorrow";
  if (lower.includes("waiting")) return "waiting";
  if (lower.includes("sleep_wake") || lower.includes("sleep") || lower.includes("wake")) return "sleep_wake";
  if (lower.includes("warning")) return "warning";
  return "love"; // default fallback
}
