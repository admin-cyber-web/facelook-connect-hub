const SUPABASE_STORAGE =
  "https://rxwvvhvretostbiknuek.supabase.co/storage/v1/object/public";

const PLACEHOLDER = "/placeholder-avatar.png";

/**
 * Resolves a Supabase storage path to a public URL.
 *
 * Rules (in order):
 *  1. Falsy / blank  → PLACEHOLDER
 *  2. Already http(s) → returned as-is
 *  3. data: URI       → returned as-is
 *  4. Path already includes bucket prefix (e.g. "avatars/file.jpg")
 *     → strip prefix so we don't double-up
 *  5. Everything else → prepend storage base + bucket
 */
export function resolveMediaUrl(
  path: string | null | undefined,
  bucket: string,
): string {
  if (!path || !path.trim()) return PLACEHOLDER;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("data:")) return path;

  const filePath = path.startsWith(bucket + "/")
    ? path.slice(bucket.length + 1)
    : path;

  if (!filePath) return PLACEHOLDER;

  return `${SUPABASE_STORAGE}/${bucket}/${filePath}`;
}

export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.(mp4|webm|ogg|mov|m4v|mkv)(\?|$)/i.test(url);
}

export function isAudioUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.(mp3|aac|wav|flac|ogg|m4a)(\?|$)/i.test(url);
}

export function isYouTubeUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes("youtube.com") || url.includes("youtu.be");
}

export function getYouTubeEmbedUrl(url: string): string {
  const match = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}?autoplay=0` : url;
}
