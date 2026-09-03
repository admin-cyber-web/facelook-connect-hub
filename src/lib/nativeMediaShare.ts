import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

const PROMO_FOOTER =
  "🎬 Join Flicks and update every time, everywhere.\n— Flicks India · flicksindia.online";

export type NativeMediaShareOutcome =
  | "shared-with-file"
  | "shared-url-only"
  | "cancelled"
  | "unsupported"
  | "error";

export interface NativeMediaShareInput {
  title: string;
  text: string;
  url: string;
  mediaUrl?: string | null;
  /** Set false when text already includes the promo footer. */
  appendPromoFooter?: boolean;
}

function getShareText(text: string, appendPromoFooter: boolean): string {
  const trimmed = text.trim();
  if (!appendPromoFooter) return trimmed;
  return trimmed ? `${trimmed}\n\n${PROMO_FOOTER}` : PROMO_FOOTER;
}

function extensionForMime(mime: string): string {
  if (mime.includes("mp4") || mime.includes("quicktime")) return "mp4";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("png")) return "png";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("heic") || mime.includes("heif")) return "heic";
  return "jpg";
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)),
    );
  }

  return btoa(binary);
}

async function cacheMediaFile(mediaUrl: string): Promise<string | null> {
  try {
    const response = await fetch(mediaUrl, { mode: "cors" });
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    if (!buffer.byteLength) return null;

    const mime = response.headers.get("content-type")?.split(";")[0].trim() || "";
    const filename = `flicks-share-${Date.now()}.${extensionForMime(mime)}`;
    await Filesystem.writeFile({
      path: filename,
      data: arrayBufferToBase64(buffer),
      directory: Directory.Cache,
      recursive: true,
    });

    const uri = await Filesystem.getUri({
      path: filename,
      directory: Directory.Cache,
    });
    return uri.uri;
  } catch {
    return null;
  }
}

function isShareCancelled(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === "AbortError";
}

/**
 * Share through Capacitor's Android share sheet with a real cache-backed URI.
 * Returns unsupported on browser/iOS so callers can keep their existing path.
 */
export async function nativeMediaShare(
  input: NativeMediaShareInput,
): Promise<NativeMediaShareOutcome> {
  if (Capacitor.getPlatform() !== "android") return "unsupported";

  const text = getShareText(input.text, input.appendPromoFooter !== false);
  const fileUri = input.mediaUrl
    ? await cacheMediaFile(input.mediaUrl)
    : null;
  const shareOptions = {
    title: input.title,
    text,
    url: input.url,
    ...(fileUri ? { files: [fileUri] } : {}),
  };

  try {
    await Share.share(shareOptions);
    return fileUri ? "shared-with-file" : "shared-url-only";
  } catch (error) {
    if (isShareCancelled(error)) return "cancelled";
  }

  // A failed file handoff should still leave the user with the URL/text share.
  if (fileUri) {
    try {
      await Share.share({ title: input.title, text, url: input.url });
      return "shared-url-only";
    } catch (error) {
      if (isShareCancelled(error)) return "cancelled";
    }
  }

  return "error";
}