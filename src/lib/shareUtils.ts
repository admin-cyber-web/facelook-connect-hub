/**
 * shareUtils.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Clean, high-reliability Native Share & Direct Social Intent Engine.
 */

import { toast } from "sonner";

export interface ShareOptions {
  title?: string;
  text?: string;
  url: string;
  mediaUrl?: string;
  mediaType?: string;
  authorName?: string;
}

export type SocialPlatform =
  | "whatsapp"
  | "facebook"
  | "messenger"
  | "instagram"
  | "twitter"
  | "telegram"
  | "copy"
  | "native";

const BASE_URL = "https://flicksindia.online";

export function formatShareUrl(rawUrl?: string): string {
  if (!rawUrl) return BASE_URL;
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    return rawUrl;
  }
  return `${BASE_URL}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
}

export function formatShareMessage(
  caption?: string,
  url?: string,
  authorName?: string,
): string {
  const cleanCaption = (caption || "").trim().slice(0, 300);
  const shareUrl = formatShareUrl(url);

  const parts = [];
  if (cleanCaption) {
    parts.push(`🎬 ${cleanCaption}`);
  }
  if (authorName && authorName.trim()) {
    parts.push(`👤 Post by ${authorName.trim()}`);
  }
  parts.push(`✨ Shared via Flicks India\n👉 Join the community: ${shareUrl}`);

  return parts.join("\n\n");
}

/**
 * Copy text to clipboard with fallback for older browsers or restricted permissions.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to execCommand
  }

  try {
    if (typeof document !== "undefined") {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand("copy");
      textarea.remove();
      return success;
    }
  } catch {
    return false;
  }
  return false;
}

declare global {
  interface Window {
    AndroidShare?: {
      shareMedia?: (
        caption: string,
        mediaUrl: string,
        mediaType?: string,
      ) => boolean | Promise<boolean>;
      shareText?: (
        title: string,
        caption: string,
        url: string,
      ) => boolean | Promise<boolean>;
      shareToPlatform?: (
        platform: string,
        caption: string,
        mediaUrl?: string,
        mediaType?: string,
      ) => boolean | Promise<boolean>;
    };
  }
}

/**
 * Convert Bunny.net .m3u8 playlist URLs to high-res video poster thumbnail images.
 */
export function resolveShareImageThumbnail(mediaUrl?: string): string | undefined {
  if (!mediaUrl) return undefined;
  const url = mediaUrl.trim();
  if (!url) return undefined;

  // Convert Bunny.net playlist.m3u8 to thumbnail.jpg
  try {
    const parsed = new URL(url);
    const bunnyMatch = parsed.pathname.match(/^\/([\w-]{8,64})\/playlist\.m3u8$/i);
    if (bunnyMatch && parsed.hostname.toLowerCase().endsWith(".b-cdn.net")) {
      return `${parsed.origin}/${bunnyMatch[1]}/thumbnail.jpg`;
    }
  } catch {
    // Return original url if parsing fails
  }
  return url;
}

/**
 * Direct Social & Native Intent execution.
 */
export async function shareToSocial(
  platform: SocialPlatform,
  opts: ShareOptions,
): Promise<boolean> {
  const shareUrl = formatShareUrl(opts.url);
  const message = formatShareMessage(opts.text, shareUrl, opts.authorName);
  const mediaImageUrl = resolveShareImageThumbnail(opts.mediaUrl);

  const encodedMessage = encodeURIComponent(message);
  const encodedUrl = encodeURIComponent(shareUrl);

  console.log(`[Share Debug] Execution starting for ${platform}:`, { shareUrl, mediaUrl: opts.mediaUrl, mediaImageUrl });

  // 1. Check native Android Bridge if running inside Android App
  if (typeof window !== "undefined" && window.AndroidShare) {
    if (platform === "native") {
      if (opts.mediaUrl && window.AndroidShare.shareMedia) {
        try {
          console.log("[Share Debug] Calling AndroidShare.shareMedia");
          window.AndroidShare.shareMedia(message, opts.mediaUrl, opts.mediaType || "image");
          return true;
        } catch (e) {
          console.warn("[shareUtils] Android native shareMedia failed:", e);
        }
      }
      if (window.AndroidShare.shareText) {
        try {
          console.log("[Share Debug] Calling AndroidShare.shareText");
          window.AndroidShare.shareText(opts.title || "Flicks India", message, shareUrl);
          return true;
        } catch (e) {
          console.warn("[shareUtils] Android native shareText failed:", e);
        }
      }
    } else if (window.AndroidShare.shareToPlatform) {
      try {
        console.log(`[Share Debug] Calling AndroidShare.shareToPlatform for ${platform}`);
        const handled = window.AndroidShare.shareToPlatform(
          platform,
          message,
          opts.mediaUrl || "",
          opts.mediaType || "image",
        );
        if (handled !== false) return true;
      } catch (e) {
        console.warn(`[shareUtils] Android native shareToPlatform (${platform}) failed:`, e);
      }
    }
  }

  // 2. Handle Copy Link
  if (platform === "copy") {
    const copied = await copyToClipboard(message);
    if (copied) {
      toast.success("Share text & link copied to clipboard!");
      return true;
    } else {
      toast.error("Unable to copy link.");
      return false;
    }
  }

  // 3. Handle Native Web Share API with File Attachment Fallback
  if (platform === "native") {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        if (mediaImageUrl && !mediaImageUrl.endsWith(".m3u8")) {
          try {
            const res = await fetch(mediaImageUrl, { mode: "cors", cache: "force-cache" });
            if (res.ok) {
              const blob = await res.blob();
              const ext = blob.type.startsWith("video/") ? "mp4" : "jpg";
              const file = new File([blob], `flicks-media.${ext}`, { type: blob.type || "image/jpeg" });
              if (navigator.canShare && navigator.canShare({ files: [file] })) {
                console.log("[Share Debug] Triggering Web Share API with media file attachment");
                await navigator.share({
                  title: opts.title || "Flicks India",
                  text: message,
                  url: shareUrl,
                  files: [file],
                });
                return true;
              }
            }
          } catch (fileErr) {
            console.warn("[shareUtils] Web Share file attachment failed, falling back to text:", fileErr);
          }
        }

        console.log("[Share Debug] Triggering Web Share API text payload");
        await navigator.share({
          title: opts.title || "Flicks India",
          text: message,
          url: shareUrl,
        });
        return true;
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return false;
        const copied = await copyToClipboard(message);
        if (copied) toast.success("Share text & link copied to clipboard!");
        return copied;
      }
    } else {
      const copied = await copyToClipboard(message);
      if (copied) toast.success("Share text & link copied to clipboard!");
      return copied;
    }
  }

  // 4. Direct Web Intents for browsers
  let targetUrl = "";
  switch (platform) {
    case "whatsapp":
      targetUrl = `https://api.whatsapp.com/send?text=${encodedMessage}`;
      break;
    case "facebook":
      targetUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
      break;
    case "messenger":
      targetUrl = `https://www.facebook.com/dialog/send?link=${encodedUrl}&app_id=296245230562520&redirect_uri=${encodedUrl}`;
      break;
    case "instagram":
      await copyToClipboard(message);
      toast.success("Share caption & link copied! Opening Instagram...");
      targetUrl = "https://www.instagram.com/";
      break;
    case "twitter":
      targetUrl = `https://twitter.com/intent/tweet?text=${encodedMessage}`;
      break;
    case "telegram":
      targetUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedMessage}`;
      break;
  }

  if (targetUrl && typeof window !== "undefined") {
    console.log(`[Share Debug] Direct Web Intent to ${platform}:`, targetUrl);
    try {
      const opened = window.open(targetUrl, "_blank", "noopener,noreferrer");
      if (!opened) {
        console.warn(`[Share Debug] Popup blocked for ${platform}, opening via location.href`);
        toast.info(`Opening ${platform}...`);
        window.location.href = targetUrl;
      }
      return true;
    } catch (err: any) {
      console.error(`[Share Debug] Error opening ${platform} intent:`, err);
      window.location.href = targetUrl;
      return true;
    }
  }

  return false;
}
