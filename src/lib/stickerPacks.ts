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
  { id: "sad-2", label: "Sad sticker 2", candidates: ["sad stickers3.webp", "sad stickers 3.webp", "sad stickers3.png", "sad-2.png", "broken-heart.png"] },
  { id: "sad-3", label: "Sad sticker 3", candidates: ["sad stickers4.webp", "sad stickers 4.webp", "sad stickers4.png", "sad stickers 4.png"] },
  { id: "sad-4", label: "Sad sticker 4", candidates: ["sad stickers5.webp", "sad stickers 5.webp", "sad stickers5.png", "sad stickers 5.png"] },
  { id: "sad-5", label: "Sad sticker 5", candidates: ["sad stickers7.webp", "sad stickers 7.webp", "sad stickers7.png", "sad stickers 7.png"] },
];

/** emotional folder: real webp & png file candidates. */
const EMOTIONAL_FILES: StickerPackFile[] = [
  { id: "emotional-1", label: "Emotional sticker 1", candidates: ["emotional stickers.webp", "emotional stickers.png", "emotional-1.png", "touching.png"] },
  { id: "emotional-2", label: "Emotional sticker 2", candidates: ["emotional stickers2.webp", "emotional stickers 2.webp", "emotional stickers2.png", "emotional-2.png", "feeling.png"] },
  { id: "emotional-3", label: "Emotional sticker 3", candidates: ["emotional stickers3.webp", "emotional stickers 3.webp", "emotional stickers3.png", "emotional stickers 3.png"] },
  { id: "emotional-4", label: "Emotional sticker 4", candidates: ["emotional stickers5.webp", "emotional stickers 5.webp", "emotional stickers5.png", "emotional stickers 5.png"] },
  { id: "emotional-5", label: "Emotional sticker 5", candidates: ["emotional stickers6.webp", "emotional stickers 6.webp", "emotional stickers6.png", "emotional stickers 6.png"] },
  { id: "emotional-6", label: "Emotional sticker 6", candidates: ["emotional stickers7.webp", "emotional stickers 7.webp", "emotional stickers7.png", "emotional stickers 7.png"] },
];

/** Angry folder: real webp & png file candidates. */
const ANGRY_FILES: StickerPackFile[] = [
  { id: "angry-1", label: "Angry sticker 1", candidates: ["angry stickers.webp", "angry stickers.png", "angry-1.png", "mad.png"] },
  { id: "angry-2", label: "Angry sticker 2", candidates: ["angry stickers2.webp", "angry stickers 2.webp", "angry stickers2.png", "angry-2.png", "grr.png"] },
  { id: "angry-3", label: "Angry sticker 3", candidates: ["angry stickers3.webp", "angry stickers 3.webp", "angry stickers3.png", "angry stickers 3.png"] },
  { id: "angry-4", label: "Angry sticker 4", candidates: ["angry stickers4.webp", "angry stickers 4.webp", "angry stickers4.png", "angry stickers 4.png"] },
  { id: "angry-5", label: "Angry sticker 5", candidates: ["angry stickers5.webp", "angry stickers 5.webp", "angry stickers5.png", "angry stickers 5.png"] },
  { id: "angry-6", label: "Angry sticker 6", candidates: ["angry stickers7.webp", "angry stickers 7.webp", "angry stickers7.png", "angry stickers 7.png"] },
  { id: "angry-7", label: "Angry sticker 7", candidates: ["angry stickers8.webp", "angry stickers 8.webp", "angry stickers8.png", "angry stickers 8.png"] },
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