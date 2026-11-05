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

export function canonicalShareUrl(value: string): string {
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
): string {
  const caption = (body || "").trim().replace(/^🎬\s*/, "");
  const headline = caption || "Watch this post on Flicks India";
  const lines = [
    `🎬 ${headline}`,
    "👉 Watch on Flicks India - Join the community!",
  ];
  const shareUrl = (url || "").trim();
  if (shareUrl) lines.push(`🔗 ${shareUrl}`);
  return lines.join("\n");
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

export type ShareTargetOutcome = "opened" | "copied" | "error";

export async function copyShareText(text: string): Promise<boolean> {
  try {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.clipboard?.writeText === "function"
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Continue to the document-based fallback for restricted browser contexts.
  }

  if (typeof document === "undefined") return false;
  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  try {
    input.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    input.remove();
  }
}

export function launchShareTarget(
  platform: ShareTarget,
  input: ShareTargetInput,
): Promise<ShareTargetOutcome> {
  const shareUrl = canonicalShareUrl(input.url);
  const shareText = buildShareText(input.text, shareUrl);
  const encodedUrl = encodeURIComponent(shareUrl);
  const whatsappText = shareText;
  const encodedWhatsAppText = encodeURIComponent(whatsappText);
  const encodedBody = encodeURIComponent(shareText);
  const whatsappWebUrl = `https://api.whatsapp.com/send?text=${encodedWhatsAppText}`;
  const isAndroid =
    typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
  const isMobileWebView =
    isAndroid ||
    (typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent)) ||
    (typeof window !== "undefined" && Boolean(window.AndroidShare));

  let targetUrls: string[];
  switch (platform) {
    case "whatsapp":
      targetUrls = isAndroid
        ? [
            `intent://send?text=${encodedWhatsAppText}#Intent;scheme=whatsapp;package=com.whatsapp;S.browser_fallback_url=${encodeURIComponent(whatsappWebUrl)};end`,
            `whatsapp://send?text=${encodedWhatsAppText}`,
            whatsappWebUrl,
          ]
        : [whatsappWebUrl, `whatsapp://send?text=${encodedWhatsAppText}`];
      break;
    case "messenger": {
      const messengerWebUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
      const messengerAppUrl = `fb-messenger://share/?link=${encodedUrl}`;
      targetUrls = isAndroid
        ? [
            `intent://share/?link=${encodedUrl}#Intent;scheme=fb-messenger;package=com.facebook.orca;S.browser_fallback_url=${encodeURIComponent(messengerWebUrl)};end`,
            messengerAppUrl,
            messengerWebUrl,
          ]
        : [messengerWebUrl, messengerAppUrl];
      break;
    }
    case "facebook":
      targetUrls = [`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`];
      break;
    case "twitter":
      targetUrls = [`https://twitter.com/intent/tweet?text=${encodedBody}&url=${encodedUrl}`];
      break;
    case "telegram":
      targetUrls = [`https://t.me/share/url?url=${encodedUrl}&text=${encodedBody}`];
      break;
  }

  if (typeof window === "undefined") return Promise.resolve("error");
  if (isMobileWebView) {
    try {
      window.location.href = targetUrls[0];
      return Promise.resolve("opened");
    } catch {
      return copyShareText(shareText).then((copied) =>
        copied ? "copied" : "error",
      );
    }
  }

  for (const targetUrl of targetUrls) {
    try {
      const link = document.createElement("a");
      link.href = targetUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      return Promise.resolve("opened");
    } catch {
      // Try the next platform URL, then copy the complete payload.
    }
  }
  return copyShareText(shareText).then((copied) =>
    copied ? "copied" : "error",
  );
}

export async function shareUrlWithNative(
  input: UniversalShareInput,
): Promise<ShareOutcome> {
  const url = canonicalShareUrl(input.url);
  const text = buildShareText(input.text, url);

  if (input.mediaUrl && typeof window !== "undefined" && window.AndroidShare?.shareMedia) {
    try {
      const result = await window.AndroidShare.shareMedia(
        text,
        input.mediaUrl,
        input.type === "reel" ? "video" : input.type,
      );
      if (result !== false) return "shared-with-file";
    } catch (error) {
      console.error("[share] Android media share failed:", error);
    }
  }

  // Call Web Share before awaiting anything so transient user activation is
  // still available in mobile browsers.
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: input.title, text, url });
      return "shared-url-only";
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return "cancelled";
    }
  }

  if (typeof window !== "undefined" && window.AndroidShare?.shareText) {
    try {
      const result = await window.AndroidShare.shareText(
        input.title,
        text,
        url,
      );
      if (result !== false) return "shared-url-only";
    } catch (error) {
      console.error("[share] Android text share failed:", error);
    }
  }

  return (await copyShareText(text)) ? "copied" : "error";
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
  type?: string | null;
  media_type?: string | null;
  media_url?: string | null;
  video_url?: string | null;
  cover_url?: string | null;
  meta_image?: string | null;
}): string | undefined {
  const t = `${post.type || ""} ${post.media_type || ""}`.toLowerCase();

  if (t.includes("reel") || t.includes("video") || post.video_url) {
    return post.video_url || post.media_url || post.cover_url || undefined;
  }
  if (t.includes("circle") || t.includes("hook")) {
    return post.cover_url || post.media_url || undefined;
  }
  return post.media_url || post.cover_url || post.meta_image || undefined;
}

export const resolveSharePreviewUrl = (url?: string): string => {
  if (!url) return "";
  const candidate = url.trim();
  if (!candidate) return "";
  try {
    const parsed = new URL(candidate);
    if (!/^https?:$/.test(parsed.protocol)) return "";
    const isVideo =
      /\.m3u8(?:$|[?#])|\.mp4(?:$|[?#])|\.m4v(?:$|[?#])|\.mov(?:$|[?#])|\.webm(?:$|[?#])|\.ogg(?:$|[?#])/i.test(
        parsed.href,
      );
    if (!isVideo) return parsed.href;

    const playlist = parsed.pathname.match(/^\/([\w-]{8,64})\/playlist\.m3u8$/i);
    if (playlist && parsed.hostname.toLowerCase().endsWith(".b-cdn.net")) {
      return `${parsed.origin}/${playlist[1]}/thumbnail.jpg`;
    }
    return "";
  } catch {
    return "";
  }
};

type SharePreviewPost = {
  type?: string | null;
  media_type?: string | null;
  media_url?: string | null;
  mediaUrl?: string | null;
  video_url?: string | null;
  videoUrl?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
  image_urls?: unknown;
  imageUrls?: unknown;
  cover_url?: string | null;
  coverUrl?: string | null;
  thumbnail_url?: string | null;
  thumbnailUrl?: string | null;
  thumb_url?: string | null;
  thumbUrl?: string | null;
  poster_url?: string | null;
  posterUrl?: string | null;
  preview_url?: string | null;
  previewUrl?: string | null;
  video_thumbnail_url?: string | null;
  videoThumbnailUrl?: string | null;
  meta_image?: string | null;
  metadata?: Record<string, unknown> | string | null;
};

function shareMetadata(post: SharePreviewPost): Record<string, unknown> {
  if (typeof post.metadata === "string") {
    try {
      const parsed: unknown = JSON.parse(post.metadata);
      return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return post.metadata ?? {};
}

function firstPreviewUrl(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string") {
      const resolved = resolveSharePreviewUrl(value);
      if (resolved) return resolved;
    } else if (Array.isArray(value)) {
      const resolved = firstPreviewUrl(...value);
      if (resolved) return resolved;
    } else if (value && typeof value === "object") {
      const item = value as Record<string, unknown>;
      const resolved = firstPreviewUrl(
        item.url,
        item.secure_url,
        item.publicUrl,
        item.image_url,
        item.media_url,
      );
      if (resolved) return resolved;
    }
  }
  return "";
}

function firstImagePreviewUrl(...values: unknown[]): string {
  for (const value of values) {
    const candidate = firstPreviewUrl(value);
    if (!candidate) continue;
    const parsed = new URL(candidate);
    const isAppPlaceholder =
      (parsed.hostname.toLowerCase() === "i.ibb.co" &&
        parsed.pathname === "/HT7RvFxs/flicksindia.png") ||
      (parsed.hostname.toLowerCase() === "flicksindia.online" &&
        ["/logo.png", "/app-icon.png"].includes(parsed.pathname.toLowerCase()));
    if (
      !isAppPlaceholder &&
      !/\.(?:m3u8|mp4|m4v|mov|webm|ogg)(?:$|[?#])/i.test(candidate) &&
      !/\/video\/upload\//i.test(candidate)
    ) {
      return candidate;
    }
  }
  return "";
}

/** Resolve a real image or poster for the shared preview; never return a video stream or app placeholder. */
export function resolveSharePreviewFromPost(post: SharePreviewPost): string {
  const metadata = shareMetadata(post);
  const videoSource = post.video_url || post.videoUrl || post.media_url || post.mediaUrl || "";
  const kind = `${post.type || ""} ${post.media_type || ""} ${metadata.mime_type || ""} ${
    metadata.mimeType || ""
  } ${metadata.content_type || ""} ${metadata.contentType || ""
  }`.toLowerCase();
  const isVideo =
    kind.includes("video") ||
    kind.includes("reel") ||
    metadata.is_video === true ||
    metadata.isVideo === true ||
    Boolean(post.video_url) ||
    Boolean(post.videoUrl) ||
    /\.m3u8(?:$|[?#])|\.mp4(?:$|[?#])|\.m4v(?:$|[?#])|\.mov(?:$|[?#])|\.webm(?:$|[?#])|\.ogg(?:$|[?#])/i.test(
      videoSource,
    );
  const posterCandidates = [
    post.preview_url,
    post.previewUrl,
    post.video_thumbnail_url,
    post.videoThumbnailUrl,
    post.thumbnail_url,
    post.thumbnailUrl,
    post.thumb_url,
    post.thumbUrl,
    post.poster_url,
    post.posterUrl,
    post.cover_url,
    post.coverUrl,
    metadata.preview_url,
    metadata.previewUrl,
    metadata.video_thumbnail_url,
    metadata.videoThumbnailUrl,
    metadata.thumbnail_url,
    metadata.thumbnailUrl,
    metadata.thumb_url,
    metadata.thumbUrl,
    metadata.poster_url,
    metadata.posterUrl,
    metadata.cover_url,
    metadata.coverUrl,
    post.image_url,
    post.imageUrl,
    post.image_urls,
    post.imageUrls,
    post.meta_image,
    metadata.image_url,
    metadata.imageUrl,
    metadata.image_urls,
    metadata.imageUrls,
  ];
  const realPoster = firstImagePreviewUrl(...posterCandidates);
  if (realPoster) return realPoster;
  return isVideo
    ? resolveSharePreviewUrl(videoSource)
    : firstImagePreviewUrl(post.media_url, post.mediaUrl);
}

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

  // Invoke a native bridge directly during the user gesture before awaiting
  // media downloads, which can consume browser transient activation.
  if (
    typeof window !== "undefined" &&
    mediaUrl &&
    typeof window.AndroidShare?.shareMedia === "function"
  ) {
    try {
      const result = await window.AndroidShare.shareMedia(text, mediaUrl, type);
      if (result !== false) return "shared-with-file";
    } catch (error) {
      console.error("[share] Android media share failed:", error);
    }
  }

  // Prefer a URL share immediately when file sharing requires an asynchronous
  // download; this keeps the native sheet within the original tap gesture.
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url });
      return "shared-url-only";
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return "cancelled";
    }
  }

  // Use the native text bridge as a reliable URL-only fallback when Web Share
  // is unavailable, even if a media URL exists but cannot be attached.
  if (
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
  if (file && typeof navigator !== "undefined" && typeof navigator.share === "function") {
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
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url });
      return "shared-url-only";
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return "cancelled";
    }
  }

  // ── Step 4: Copy link to clipboard ────────────────────────────────────────
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "error";
  }
}
