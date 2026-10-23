/**
 * universalShare.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Production-ready file-based sharing utility.
 *
 * Priority chain:
 *   1. AndroidShare.shareMedia(caption, mediaUrl) ← native Android bridge
 *   2. navigator.share({ files: [File] })          ← OS sheet WITH image/video
 *   3. navigator.share({ title, text, url })       ← URL-only fallback
 *   4. navigator.clipboard.writeText(url)          ← last resort
 *
 * Media resolution by post type:
 *   post / story → media_url (image or video)
 *   reel         → media_url/video_url (actual media), then cover_url
 *   circle       → cover_url (banner)
 *   hook         → cover_url (page banner)
 *   quote        → caller passes HTMLCanvasElement directly
 */

export type PostType = "post" | "reel" | "circle" | "hook" | "quote" | "story";
export type ShareTarget =
  | "whatsapp"
  | "messenger"
  | "facebook"
  | "twitter"
  | "telegram";

const FLICKS_BASE_URL = "https://flicksindia.online";

export function buildPostShareUrl(postId: string): string {
  return `${FLICKS_BASE_URL}/post/${encodeURIComponent(postId)}`;
}

function canonicalShareUrl(value: string): string {
  try {
    const parsed = new URL(value, FLICKS_BASE_URL);
    const postPath = parsed.pathname.match(/\/post\/([^/]+)/);
    const postId =
      postPath?.[1] ||
      parsed.searchParams.get("post") ||
      parsed.searchParams.get("id");

    if (postId) return buildPostShareUrl(decodeURIComponent(postId));
    return parsed.toString();
  } catch {
    return value;
  }
}

/**
 * Build the final share text: body + link (optional) + blank line + promo footer.
 * Safe to call with empty/null body/url.
 */
export function buildShareText(
  body?: string | null,
  url?: string | null,
  _mediaUrl?: string | null,
): string {
  const trimmed = (body || "").trim();
  const urlStr = (url || "").trim();
  const parts = [trimmed];

  if (urlStr && !trimmed.includes(urlStr)) {
    parts.push(`🔗 Open on Flicks India: ${urlStr}`);
  }

  return parts.filter(Boolean).join("\n\n");
}

export interface UniversalShareInput {
  title: string;
  text: string;
  url: string;
  mediaUrl?: string;
  previewUrl?: string;
  authorName?: string;
  canvas?: HTMLCanvasElement;
  type?: PostType;
}

export interface ShareTargetInput {
  title: string;
  text: string;
  url: string;
  mediaUrl?: string;
  previewUrl?: string;
  authorName?: string;
  type?: PostType;
}

export function launchShareTarget(
  platform: ShareTarget,
  input: ShareTargetInput,
): boolean {
  const shareUrl = canonicalShareUrl(input.url);
  const shareText = buildShareText(input.text, shareUrl);
  const bodyText = input.text.trim();
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);
  const encodedBody = encodeURIComponent(bodyText);

  let targetUrl: string;
  switch (platform) {
    case "whatsapp":
      targetUrl = `https://wa.me/?text=${encodedText}`;
      break;
    case "messenger":
      targetUrl = `https://www.facebook.com/dialog/send?link=${encodedUrl}`;
      break;
    case "facebook":
      targetUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
      break;
    case "twitter":
      targetUrl = `https://twitter.com/intent/tweet?text=${encodedBody}&url=${encodedUrl}`;
      break;
    case "telegram":
      targetUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedBody}`;
      break;
  }

  if (typeof window === "undefined") return false;
  try {
    window.open(targetUrl, "_blank", "noopener,noreferrer");
    return true;
  } catch {
    return false;
  }
}

declare global {
  interface Window {
    AndroidShare?: {
      shareMedia?: (
        caption: string,
        mediaUrl: string,
        mediaType?: string,
      ) => void | boolean | Promise<void | boolean>;
      shareText?: (
        title: string,
        caption: string,
        url: string,
      ) => boolean | Promise<boolean>;
    };
  }
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
 * Reels → media_url/video_url (actual media), then cover_url (thumbnail).
 * Posts/Stories → media_url. Falls back through available fields.
 */
export function resolveShareMediaUrl(post: {
  type?: string;
  media_url?: string;
  video_url?: string;
  cover_url?: string;
  meta_image?: string;
}): string | undefined {
  const t = post.type?.toLowerCase() ?? "";

  if (t === "reel" || t === "video") {
    return post.media_url || post.video_url || post.cover_url;
  }
  if (t === "circle" || t === "hook") {
    return post.cover_url || post.media_url;
  }
  return post.media_url || post.cover_url || post.meta_image;
}

export const resolveSharePreviewUrl = (url?: string): string => {
  if (!url) return "";
  return url;
};

/**
 * Use the Android WebView bridge when the native app provides it.
 *
 * The bridge can return void, a promise, or a boolean success value depending
 * on the Android wrapper version. A false result or thrown/rejected call means
 * the browser fallback should continue.
 */
export async function shareViaAndroid(
  caption: string,
  mediaUrl?: string | null,
  mediaType?: string,
): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    !mediaUrl ||
    typeof window.AndroidShare?.shareMedia !== "function"
  ) {
    return false;
  }

  try {
    const result = await window.AndroidShare.shareMedia(caption, mediaUrl, mediaType);
    return result !== false;
  } catch {
    return false;
  }
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
  const { title, canvas, type = "post" } = input;
  const url = canonicalShareUrl(input.url);
  const mediaUrl = input.mediaUrl || input.previewUrl;

  // Keep the crawler-ready post URL in text; media is attached separately when supported.
  const text = buildShareText(input.text, url);

  // Android handles the remote media natively. Do this before fetching a blob
  // so the WebView does not duplicate the media download in JavaScript.
  if (await shareViaAndroid(text, mediaUrl, type)) {
    return "shared-with-file";
  }

  // Text-only posts still need a native chooser on Android WebView, where the
  // browser Web Share API may not be available.
  if (
    !mediaUrl &&
    typeof window !== "undefined" &&
    typeof window.AndroidShare?.shareText === "function"
  ) {
    try {
      const result = await window.AndroidShare.shareText(title, text, url);
      if (result !== false) return "shared-url-only";
    } catch {
      // Continue to the Web Share API and clipboard fallbacks.
    }
  }

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
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return "copied";
  } catch {
    return "error";
  }
}
