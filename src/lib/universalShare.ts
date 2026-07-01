/**
 * universalShare.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Production-ready file-based sharing utility.
 *
 * Priority chain:
 *   1. navigator.share({ files: [File] })  ← opens OS sheet WITH image/video
 *   2. navigator.share({ title, text, url }) ← URL-only fallback
 *   3. navigator.clipboard.writeText(url)    ← last resort
 *
 * Media resolution by post type:
 *   post / story → media_url (image or video)
 *   reel         → cover_url (thumbnail) + 2-line caption
 *   circle       → cover_url (banner)
 *   hook         → cover_url (page banner)
 *   quote        → caller passes HTMLCanvasElement directly
 */

export type PostType = "post" | "reel" | "circle" | "hook" | "quote" | "story";

export interface UniversalShareInput {
  title: string;
  text: string;
  url: string;
  mediaUrl?: string;
  canvas?: HTMLCanvasElement;
  type?: PostType;
}

export type ShareOutcome =
  | "shared-with-file"
  | "shared-url-only"
  | "copied"
  | "cancelled"
  | "error";

// ── File builders ─────────────────────────────────────────────────────────────

/**
 * Convert a remote URL into a File object by fetching it.
 * Returns null on CORS failure or network error (caller falls back to URL share).
 */
export async function fetchMediaAsFile(
  mediaUrl: string,
  type: PostType = "post",
): Promise<File | null> {
  try {
    const res = await fetch(mediaUrl, { mode: "cors", cache: "force-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.size) return null;

    const isVideo = blob.type.startsWith("video/");
    const ext = isVideo
      ? "mp4"
      : blob.type.includes("png")
        ? "png"
        : blob.type.includes("gif")
          ? "gif"
          : blob.type.includes("webp")
            ? "webp"
            : "jpg";
    const mime = blob.type || (isVideo ? "video/mp4" : "image/jpeg");

    return new File([blob], `flicks-${type}-${Date.now()}.${ext}`, {
      type: mime,
    });
  } catch {
    return null;
  }
}

/**
 * Convert an HTMLCanvasElement into a File object.
 * Returns null if canvas is unavailable or toBlob fails.
 */
export async function canvasToFile(
  canvas: HTMLCanvasElement,
  quality = 0.92,
): Promise<File | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(null); return; }
          resolve(
            new File([blob], `flicks-quote-${Date.now()}.jpg`, {
              type: "image/jpeg",
            }),
          );
        },
        "image/jpeg",
        quality,
      );
    } catch {
      resolve(null);
    }
  });
}

// ── Media URL resolver ────────────────────────────────────────────────────────

/**
 * Given a raw post object, returns the most appropriate media URL for sharing.
 * Reels → cover_url (thumbnail). Circles/Hooks → cover_url (banner).
 * Posts/Stories → media_url. Falls back through available fields.
 */
export function resolveShareMediaUrl(post: {
  type?: string;
  media_url?: string;
  cover_url?: string;
  meta_image?: string;
}): string | undefined {
  const t = post.type?.toLowerCase() ?? "";

  if (t === "reel" || t === "video") {
    return post.cover_url || post.media_url;
  }
  if (t === "circle" || t === "hook") {
    return post.cover_url || post.media_url;
  }
  return post.media_url || post.cover_url || post.meta_image;
}

// ── Core share function ───────────────────────────────────────────────────────

/**
 * Attempt to share content, with a full fallback chain.
 *
 * Usage from a feed item:
 *   const outcome = await universalShare({
 *     title: post.meta_title ?? post.content?.slice(0, 60) ?? 'Check this!',
 *     text:  post.content ?? '',
 *     url:   `${window.location.origin}/?post=${post.id}`,
 *     mediaUrl: resolveShareMediaUrl(post),
 *     type: post.type as PostType,
 *   });
 *
 * Usage from QuotesMaker:
 *   const outcome = await universalShare({
 *     title: 'My Quote',
 *     text: quoteText,
 *     url: window.location.href,
 *     canvas: canvasRef.current!,
 *     type: 'quote',
 *   });
 */
export async function universalShare(
  input: UniversalShareInput,
): Promise<ShareOutcome> {
  const { title, text, url, mediaUrl, canvas, type = "post" } = input;

  // ── Step 1: Build a File object ───────────────────────────────────────────
  let file: File | null = null;

  if (canvas) {
    file = await canvasToFile(canvas);
  } else if (mediaUrl) {
    file = await fetchMediaAsFile(mediaUrl, type);
  }

  // ── Step 2: Try file-based native share ───────────────────────────────────
  if (file && typeof navigator.share === "function") {
    const shareData: ShareData = { title, text, url, files: [file] };
    const canShare =
      typeof navigator.canShare === "function"
        ? navigator.canShare(shareData)
        : true; // Assume yes if canShare not available

    if (canShare) {
      try {
        await navigator.share(shareData);
        return "shared-with-file";
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return "cancelled";
        // Intentional fall-through to next tier
      }
    }
  }

  // ── Step 3: URL-only native share ─────────────────────────────────────────
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url });
      return "shared-url-only";
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return "cancelled";
    }
  }

  // ── Step 4: Copy link to clipboard ────────────────────────────────────────
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "error";
  }
}
