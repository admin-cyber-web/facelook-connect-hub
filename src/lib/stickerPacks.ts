/**
 * BunnyCDN sticker pack manifest.
 *
 * Single source of truth for the files that actually exist on the
 * flicksindiacdn.b-cdn.net pull zone. The storage layout is:
 *
 *   Stickers/<Category>/<file>.webp
 *
 * Filenames contain spaces, so they are kept unencoded here and
 * bunnyStickerUrl() encodes each path segment ("love stickers.webp" becomes
 * "love%20stickers.webp") before the request is made.
 *
 * Each sticker lists candidate filenames in priority order. The first one that
 * loads wins; if all candidates fail the sticker is hidden instead of rendering
 * a broken image, and the failure is only logged once.
 */

import { bunnyStickerUrl, type StickerPackCategory } from "./bunny";

export type StickerPackFile = {
  /** Stable id used as React key and as the probe-state key. */
  id: string;
  /** Human readable name (used for alt text). */
  label: string;
  /** Filenames inside the category folder, tried in order. */
  candidates: string[];
};

/** Love folder: real webp & png file candidates. */
const LOVE_FILES: StickerPackFile[] = [
  { id: "love-1", label: "Love sticker 1", candidates: ["love stickers.webp", "love stickers.png", "love-1.png", "love.png"] },
  { id: "love-2", label: "Love sticker 2", candidates: ["love stickers2.webp", "love stickers 2.webp", "love stickers2.png", "love-2.png"] },
  { id: "love-3", label: "Love sticker 3", candidates: ["love stickers 3.webp", "love stickers3.webp", "love stickers 3.png", "love-3.png"] },
  { id: "love-4", label: "Love sticker 4", candidates: ["love stickers 4.webp", "love stickers4.webp", "love stickers 4.png", "heart.png"] },
  { id: "love-5", label: "Love sticker 5", candidates: ["love stickers 5.webp", "love stickers5.webp", "love stickers 5.png", "kiss.png"] },
  { id: "love-6", label: "Love sticker 6", candidates: ["love stickers 6.webp", "love stickers6.webp", "love stickers 6.png", "cute.png"] },
  { id: "love-7", label: "Love sticker 7", candidates: ["love stickers 7.webp", "love stickers7.webp", "love stickers 7.png"] },
];

/** Sad folder: real webp & png file candidates. */
const SAD_FILES: StickerPackFile[] = [
  { id: "sad-1", label: "Sad sticker 1", candidates: ["sad stickers.webp", "sad stickers.png", "sad-1.png", "tears.png", "lonely.png"] },
  { id: "sad-2", label: "Sad sticker 2", candidates: ["sad stickers 2.webp", "sad stickers2.webp", "sad stickers 2.png", "sad-2.png", "broken-heart.png"] },
];

/** emotional folder: real webp & png file candidates. */
const EMOTIONAL_FILES: StickerPackFile[] = [
  { id: "emotional-1", label: "Emotional sticker 1", candidates: ["emotional stickers.webp", "emotional stickers.png", "emotional-1.png", "touching.png"] },
  { id: "emotional-2", label: "Emotional sticker 2", candidates: ["emotional stickers2.webp", "emotional stickers 2.webp", "emotional stickers2.png", "emotional-2.png", "miss-you.png"] },
];

/** Angry folder: real webp & png file candidates. */
const ANGRY_FILES: StickerPackFile[] = [
  { id: "angry-1", label: "Angry sticker 1", candidates: ["angry stickers.webp", "angry stickers.png", "angry-1.png", "mad.png"] },
  { id: "angry-2", label: "Angry sticker 2", candidates: ["angry stickers2.webp", "angry stickers 2.webp", "angry stickers2.png", "angry-2.png", "grr.png"] },
];

/** Sticker pack categories available on the pull zone. */
export const STICKER_PACK_CATEGORIES: StickerPackCategory[] = ["Love", "Sad", "emotional", "Angry"];

/** Sticker files per category. */
export const STICKER_PACK_FILES: Record<StickerPackCategory, StickerPackFile[]> = {
  Love: LOVE_FILES,
  Sad: SAD_FILES,
  emotional: EMOTIONAL_FILES,
  Angry: ANGRY_FILES,
};

/** Resolve the URL for a specific candidate of a sticker file. */
export function stickerCandidateUrl(
  category: StickerPackCategory,
  file: StickerPackFile,
  candidateIndex = 0
): string {
  const candidates = file.candidates.length ? file.candidates : [""];
  const index = Math.min(Math.max(candidateIndex, 0), candidates.length - 1);
  return bunnyStickerUrl(category, candidates[index]);
}

/** Media type stored with a sent sticker so the bubble renders it as an image. */
export function stickerMediaType(url: string): string {
  return /\.webp(?:[?#]|$)/i.test(url) ? "image/webp" : "image/png";
}
