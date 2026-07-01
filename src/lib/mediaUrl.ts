import { supabase } from "./supabaseClient";

const BUCKET_PREFIXES: Record<string, string> = {
  posts:       "posts",
  flicks:      "flicks",
  avatars:     "avatars",
  circles:     "circles",
  hooks:       "hooks",
  "chat-images": "chat-images",
  stories:     "stories",
};

/**
 * Resolves a media reference to a usable public URL.
 *
 * - If `raw` is already a full http(s) URL → returned unchanged.
 * - If `raw` starts with a known bucket name prefix (e.g. "posts/file.mp4")
 *   → the bucket is inferred automatically and getPublicUrl is called.
 * - If `forceBucket` is supplied it overrides the auto-detection.
 * - Returns null / empty-string inputs as empty string (never null).
 */
export function resolveMediaUrl(
  raw: string | null | undefined,
  forceBucket?: string,
): string {
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;

  const bucket =
    forceBucket ??
    Object.keys(BUCKET_PREFIXES).find((b) => raw.startsWith(b + "/"));

  if (!bucket) return raw;

  const path = raw.startsWith(bucket + "/") ? raw.slice(bucket.length + 1) : raw;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/**
 * Returns true if the URL / path looks like a video.
 */
export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.(mp4|webm|ogg|mov|m4v|mkv)(\?|$)/i.test(url);
}

/**
 * Returns true if the URL / path looks like an audio file.
 */
export function isAudioUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.(mp3|aac|wav|flac|ogg|m4a)(\?|$)/i.test(url);
}

/**
 * Returns true if the URL is a YouTube link.
 */
export function isYouTubeUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes("youtube.com") || url.includes("youtu.be");
}

/**
 * Converts a YouTube watch URL to an embed URL.
 */
export function getYouTubeEmbedUrl(url: string): string {
  const match = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}?autoplay=0` : url;
}
