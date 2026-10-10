/**
 * universalShare.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared text, URL, and media helpers for Flicks India.
 *
 * Platform buttons open their selected destination. The clipboard is reserved
 * for an explicit Copy Link action.
 *
 * The original media URL is kept separate from the direct share-preview URL:
 * reels use their video as original media and a poster/cover as the preview.
 * Default meta images are intentionally excluded so app logos cannot replace
 * an item's actual media.
 */

export type PostType = "post" | "reel" | "circle" | "hook" | "quote" | "story";

const FLICKS_BASE_URL = "https://flicksindia.online";
const PROMO_PREVIEW_URL = "https://i.ibb.co/HT7RvFxs/flicksindia.png";

export function buildPostShareUrl(postId: string): string {
  return `${FLICKS_BASE_URL}/post/${encodeURIComponent(postId)}`;
}

function canonicalPostUrl(url?: string | null): string {
  const value = (url || "").trim();
  if (!value) return FLICKS_BASE_URL;

  try {
    const parsed = new URL(value, FLICKS_BASE_URL);
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const postIndex = pathParts.findIndex((part) => part.toLowerCase() === "post");
    const postId =
      (postIndex >= 0 ? pathParts[postIndex + 1] : undefined) ||
      parsed.searchParams.get("post") ||
      parsed.searchParams.get("id");
    return postId ? buildPostShareUrl(decodeURIComponent(postId)) : value;
  } catch {
    return value;
  }
}

/**
 * Build the same rich share payload for native shares and platform intents.
 * The caption is shortened when needed, followed by a consistent author credit
 * and canonical post link.
 */
export function buildShareText(
  body?: string | null,
  url?: string | null,
  authorName?: string | null,
  mediaUrl?: string | null,
): string {
  const trimmed = (body || "").trim().replace(/\r\n/g, "\n");
  const lines = trimmed.split("\n");
  let snippet = lines.slice(0, 3).join("\n").slice(0, 280).trim();
  const hasMore = lines.length > 3 || trimmed.length > snippet.length;
  if (snippet && hasMore) snippet += "... Read More";

  const author = authorName?.trim() || "Flicks India";
  const attribution = [
    `📸 Posted by: ${author}`,
    mediaUrl ? `📸 View Media: ${mediaUrl}` : null,
    `👉 Join Flicks India: ${FLICKS_BASE_URL}`,
    `🔗 View Post: ${canonicalPostUrl(url)}`,
  ]
    .filter(Boolean)
    .join("\n");
  return snippet ? `${snippet}\n\n${attribution}` : attribution;
}

export type ShareTarget =
  | "whatsapp"
  | "messenger"
  | "facebook"
  | "instagram"
  | "twitter"
  | "telegram";

export interface ShareTargetInput {
  title: string;
  text: string;
  url: string;
  mediaUrl?: string;
  previewUrl?: string;
  authorName?: string;
  type?: PostType;
}

function openExternalUrl(url: string): boolean {
  if (/Android/i.test(navigator.userAgent) && window.AndroidShare) {
    window.location.assign(url);
    return true;
  }

  const popup = window.open(url, "_blank");
  if (popup) {
    popup.opener = null;
    return true;
  }
  window.location.assign(url);
  return true;
}

function openAppLink(appUrl: string, fallbackUrl: string): boolean {
  window.location.assign(appUrl);
  window.setTimeout(() => {
    if (document.visibilityState !== "hidden") {
      window.location.assign(fallbackUrl);
    }
  }, 900);
  return true;
}

/**
 * Open the selected platform directly. Android builds can target an installed
 * app through the native bridge; browsers use the platform's own share URL.
 */
export async function launchShareTarget(
  platform: ShareTarget,
  input: ShareTargetInput,
): Promise<boolean> {
  const mediaUrl =
    firstMediaUrl(input.mediaUrl) || firstMediaUrl(input.previewUrl);
  const previewUrl = mediaUrl
    ? firstMediaUrl(input.previewUrl) || mediaUrl
    : PROMO_PREVIEW_URL;
  const nativeText = buildShareText(
    input.text,
    input.url,
    input.authorName,
    mediaUrl,
  );
  const platformText = nativeText;

  if (typeof window.AndroidShare?.shareToPlatform === "function") {
    try {
      const result = window.AndroidShare.shareToPlatform(
        platform,
        nativeText,
        mediaUrl || previewUrl,
        input.type || "post",
      );
      if (result === true) return true;
      if (result && typeof (result as Promise<unknown>).then === "function") {
        if (await result) return true;
      }
    } catch {
      // Continue to the platform's web/deep link when the native target is unavailable.
    }
  }

  const encodedUrl = encodeURIComponent(previewUrl || input.url || PROMO_PREVIEW_URL);
  const encodedText = encodeURIComponent(platformText);
  switch (platform) {
    case "whatsapp":
      return openExternalUrl(`https://api.whatsapp.com/send?text=${encodedText}`);
    case "facebook":
      return openExternalUrl(
        `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
      );
    case "twitter":
      return openExternalUrl(
        `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      );
    case "telegram":
      return openExternalUrl(
        `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      );
    case "instagram": {
      const fallback = "https://www.instagram.com/";
      const appUrl = /Android/i.test(navigator.userAgent)
        ? `intent://app#Intent;scheme=instagram;package=com.instagram.android;S.browser_fallback_url=${encodeURIComponent(fallback)};end`
        : "instagram://app";
      return openAppLink(appUrl, fallback);
    }
    case "messenger": {
      const fallback = "https://www.messenger.com/";
      const appUrl = `fb-messenger://share?link=${encodedUrl}`;
      return openAppLink(appUrl, fallback);
    }
  }
}

export interface UniversalShareInput extends ShareMediaFields {
  title: string;
  text: string;
  url: string;
  authorName?: string;
  canvas?: HTMLCanvasElement;
  type?: PostType;
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
      ) => void | boolean | Promise<void | boolean>;
      shareToPlatform?: (
        platform: ShareTarget,
        caption: string,
        mediaUrl: string,
        mediaType?: string,
      ) => void | boolean | Promise<void | boolean>;
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

function canvasToFileSync(canvas: HTMLCanvasElement): File | null {
  try {
    const [header, encoded] = canvas.toDataURL("image/jpeg", 0.92).split(",");
    if (!header || !encoded) return null;
    const mime = header.match(/^data:(.*?);base64$/)?.[1] || "image/jpeg";
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new File([bytes], "flicks-quote.jpg", { type: mime });
  } catch {
    return null;
  }
}

// ── Media URL resolver ────────────────────────────────────────────────────────

/**
 * Given a post or request object, returns the original media URL.
 * For video posts this remains the actual video source; use
 * resolveSharePreviewUrl when preparing the Web Share URL.
 */
type ShareMediaFields = {
  type?: string;
  media_type?: string;
  mediaType?: string;
  media_url?: string;
  mediaUrl?: string;
  image_url?: string;
  imageUrl?: string;
  image_urls?: unknown;
  imageUrls?: unknown;
  video_url?: string;
  videoUrl?: string;
  cover_url?: string;
  coverUrl?: string;
  thumb_url?: string;
  thumbUrl?: string;
  thumbnail_url?: string;
  thumbnailUrl?: string;
  poster_url?: string;
  posterUrl?: string;
  preview_url?: string;
  previewUrl?: string;
  video_thumbnail_url?: string;
  videoThumbnailUrl?: string;
  metadata?: unknown;
  post?: {
    media_url?: string;
    image_url?: string;
  };
};

function firstMediaUrl(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string") {
      const candidate = value.trim();
      if (!candidate) continue;

      if (candidate.startsWith("[") || candidate.startsWith("{")) {
        try {
          const parsed: unknown = JSON.parse(candidate);
          const nested = firstMediaUrl(parsed);
          if (nested) return nested;
          continue;
        } catch {
          // Treat malformed JSON-like strings as a literal URL below.
        }
      }

      const firstUrl = candidate.split(/,(?=https?:\/\/)/, 1)[0]?.trim();
      if (firstUrl && !isStaticAppShareImage(firstUrl)) return firstUrl;
      continue;
    }

    if (Array.isArray(value)) {
      const nested = firstMediaUrl(...value);
      if (nested) return nested;
      continue;
    }

    if (value && typeof value === "object") {
      const objectValue = value as Record<string, unknown>;
      const nested = firstMediaUrl(
        objectValue.url,
        objectValue.secure_url,
        objectValue.publicUrl,
        objectValue.image_url,
        objectValue.media_url,
        objectValue.video_url,
      );
      if (nested) return nested;
    }
  }
  return undefined;
}

function isStaticAppShareImage(candidate: string): boolean {
  try {
    const parsed = new URL(candidate, FLICKS_BASE_URL);
    const promo = new URL(PROMO_PREVIEW_URL);
    return (
      (parsed.hostname === promo.hostname && parsed.pathname === promo.pathname) ||
      (parsed.hostname.toLowerCase() === "flicksindia.online" &&
        ["/logo.png", "/app-icon.png"].includes(parsed.pathname.toLowerCase()))
    );
  } catch {
    return false;
  }
}

function shareMetadata(post: ShareMediaFields): Record<string, unknown> {
  return post.metadata && typeof post.metadata === "object"
    ? (post.metadata as Record<string, unknown>)
    : {};
}

function isVideoShare(post: ShareMediaFields): boolean {
  const metadata = shareMetadata(post);
  if (
    ["reel", "video"].includes(post.type?.toLowerCase() ?? "") ||
    post.media_type?.toLowerCase().startsWith("video") ||
    post.mediaType?.toLowerCase().startsWith("video")
  ) return true;
  if (metadata.is_video === true || metadata.isVideo === true) return true;

  if (
    firstMediaUrl(
      post.video_url,
      post.videoUrl,
      metadata.video_url,
      metadata.videoUrl,
    )
  ) {
    return true;
  }

  const source = firstMediaUrl(
    post.media_url,
    post.mediaUrl,
    metadata.media_url,
    metadata.mediaUrl,
  );
  return !!source && /\/video\/upload\/|\.(?:mp4|m4v|mov|webm|ogg|m3u8)(?:[?#]|$)/i.test(source);
}

function shareImageCandidates(post: ShareMediaFields): unknown[] {
  const metadata = shareMetadata(post);
  return [
    post.image_url,
    post.imageUrl,
    post.image_urls,
    post.imageUrls,
    metadata.image_url,
    metadata.imageUrl,
    metadata.image_urls,
    metadata.imageUrls,
  ];
}

function sharePreviewCandidates(post: ShareMediaFields): unknown[] {
  const metadata = shareMetadata(post);
  return [
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
  ];
}

export function resolveShareMediaUrl(post: ShareMediaFields): string | undefined {
  const metadata = shareMetadata(post);
  const isVideo = isVideoShare(post);
  const imageCandidates = shareImageCandidates(post);
  const videoCandidates = [
    post.video_url,
    post.videoUrl,
    metadata.video_url,
    metadata.videoUrl,
  ];
  const mediaCandidates = [
    post.media_url,
    post.mediaUrl,
    metadata.media_url,
    metadata.mediaUrl,
  ];

  return firstMediaUrl(
    ...(isVideo
      ? [...videoCandidates, ...mediaCandidates, ...imageCandidates]
      : [...imageCandidates, ...mediaCandidates, ...videoCandidates]),
    ...sharePreviewCandidates(post),
  );
}

/**
 * Returns the most useful direct visual URL for a web/native share preview.
 * For video, prefer its poster/thumbnail over the video file itself.
 */
export function resolveSharePreviewUrl(
  post: ShareMediaFields,
): string | undefined {
  const metadata = shareMetadata(post);
  const isVideo = isVideoShare(post);
  const videoCandidates = [
    post.video_url,
    post.videoUrl,
    metadata.video_url,
    metadata.videoUrl,
  ];
  const mediaCandidates = [
    post.media_url,
    post.mediaUrl,
    metadata.media_url,
    metadata.mediaUrl,
  ];
  const imageCandidates = shareImageCandidates(post);

  return firstMediaUrl(
    ...(isVideo
      ? [...sharePreviewCandidates(post), ...imageCandidates, ...videoCandidates, ...mediaCandidates]
      : [...imageCandidates, ...mediaCandidates, ...sharePreviewCandidates(post), ...videoCandidates]),
  );
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

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Try the legacy WebView-compatible clipboard path below.
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
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
  const { title, url, canvas, type = "post" } = input;
  const payload = input;
  const mediaUrl =
    payload.imageUrl ||
    payload.media_url ||
    payload.coverUrl ||
    payload.post?.media_url ||
    payload.post?.image_url;
  const resolvedMediaUrl =
    firstMediaUrl(mediaUrl) ||
    firstMediaUrl(payload.mediaUrl) ||
    resolveShareMediaUrl(payload);
  const resolvedPreviewUrl = resolveSharePreviewUrl(payload);
  const previewUrl = resolvedMediaUrl
    ? firstMediaUrl(resolvedPreviewUrl) || resolvedMediaUrl
    : PROMO_PREVIEW_URL;
  const text = buildShareText(
    input.text,
    url,
    input.authorName,
    resolvedMediaUrl,
  );
  const shareUrl = previewUrl || resolvedMediaUrl || PROMO_PREVIEW_URL;
  const shareData: ShareData = { title, text, url: shareUrl };
  let sharedWithFile = false;

  // Call Web Share first while the user's click activation is still live.
  // Canvas conversion is synchronous so it can join that same activation.
  if (typeof navigator.share === "function") {
    if (canvas) {
      const file = canvasToFileSync(canvas);
      if (file) {
        const fileShareData: ShareData = { ...shareData, files: [file] };
        try {
          if (!navigator.canShare || navigator.canShare(fileShareData)) {
            Object.assign(shareData, fileShareData);
            sharedWithFile = true;
          }
        } catch {
          // Share the rich text and URL if file sharing is unavailable.
        }
      }
    }

    try {
      await navigator.share(shareData);
      return sharedWithFile ? "shared-with-file" : "shared-url-only";
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return "cancelled";
      // Native sharing can be disabled or reject in Android WebViews; continue
      // through the native bridge and clipboard fallbacks.
    }
  }

  // Android handles remote media without making the WebView download it again.
  const bridgeMediaUrl = resolvedMediaUrl || previewUrl;
  if (bridgeMediaUrl && typeof window.AndroidShare?.shareMedia === "function") {
    try {
      const result = await window.AndroidShare.shareMedia(text, bridgeMediaUrl, type);
      if (result !== false) return "shared-with-file";
    } catch {
      // Continue to text bridge or clipboard.
    }
  }

  if (typeof window.AndroidShare?.shareText === "function") {
    try {
      const result = await window.AndroidShare.shareText(title, text, url);
      if (result !== false) return "shared-url-only";
    } catch {
      // Continue to clipboard.
    }
  }

  return (await copyTextToClipboard(text)) ? "copied" : "error";
}
