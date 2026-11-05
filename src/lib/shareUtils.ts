/**
 * shareUtils.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Clean, high-reliability Native Share & Social Web Intent Engine.
 */

import { toast } from "sonner";

export interface ShareOptions {
  title?: string;
  text?: string;
  url: string;
  mediaUrl?: string;
}

export type SocialPlatform =
  | "whatsapp"
  | "facebook"
  | "messenger"
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

export function formatShareMessage(caption?: string, url?: string): string {
  const cleanCaption = (caption || "").trim().slice(0, 300);
  const shareUrl = formatShareUrl(url);
  if (cleanCaption) {
    return `🎬 ${cleanCaption}\n\n👉 Watch on Flicks India: ${shareUrl}`;
  }
  return `👉 Check this out on Flicks India: ${shareUrl}`;
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

/**
 * Direct Web Intent execution for specific social platforms.
 * Always executes instantly in response to a user click gesture.
 */
export async function shareToSocial(
  platform: SocialPlatform,
  opts: ShareOptions,
): Promise<boolean> {
  const shareUrl = formatShareUrl(opts.url);
  const message = formatShareMessage(opts.text, shareUrl);

  const encodedMessage = encodeURIComponent(message);
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent((opts.text || "").trim().slice(0, 200) || "Check this out on Flicks India");

  // Check native Android Bridge if available in mobile webview
  if (platform === "native" || platform === "whatsapp") {
    if (
      typeof window !== "undefined" &&
      window.AndroidShare?.shareText
    ) {
      try {
        window.AndroidShare.shareText(opts.title || "Flicks India", message, shareUrl);
        return true;
      } catch {
        // Fall back to web intent
      }
    }
  }

  // Handle native OS Share Sheet
  if (platform === "native") {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: opts.title || "Flicks India",
          text: message,
          url: shareUrl,
        });
        return true;
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return false;
        // Fallback to copying link
        const copied = await copyToClipboard(shareUrl);
        if (copied) toast.success("Link copied to clipboard!");
        return copied;
      }
    } else {
      const copied = await copyToClipboard(shareUrl);
      if (copied) toast.success("Link copied to clipboard!");
      return copied;
    }
  }

  // Handle Copy Link
  if (platform === "copy") {
    const copied = await copyToClipboard(shareUrl);
    if (copied) {
      toast.success("Link copied to clipboard!");
      return true;
    } else {
      toast.error("Unable to copy link.");
      return false;
    }
  }

  // Direct Social Web Intents
  let targetUrl = "";
  switch (platform) {
    case "whatsapp":
      targetUrl = `https://api.whatsapp.com/send?text=${encodedMessage}`;
      break;
    case "facebook":
    case "messenger":
      targetUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
      break;
    case "twitter":
      targetUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
      break;
    case "telegram":
      targetUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
      break;
  }

  if (targetUrl && typeof window !== "undefined") {
    window.open(targetUrl, "_blank", "noopener,noreferrer");
    return true;
  }

  return false;
}
