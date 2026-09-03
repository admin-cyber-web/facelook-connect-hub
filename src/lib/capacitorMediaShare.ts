import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

const PROMO_FOOTER =
  "🎬 Join Flicks and update every time, everywhere.\n— Flicks India · flicksindia.online";

export type CapacitorShareOutcome =
  | "shared-with-file"
  | "shared-url-only"
  | "cancelled"
  | "unsupported"
  | "error";

function extensionForMedia(mime: string, mediaUrl: string): string {
  const normalizedMime = mime.toLowerCase();
  if (normalizedMime.includes("mp4") || normalizedMime.includes("quicktime")) return "mp4";
  if (normalizedMime.includes("webm")) return "webm";
  if (normalizedMime.includes("png")) return "png";
  if (normalizedMime.includes("gif")) return "gif";
  if (normalizedMime.includes("webp")) return "webp";
  if (normalizedMime.includes("heic") || normalizedMime.includes("heif")) return "heic";

  const extension = mediaUrl.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase();
  return extension && /^[a-z0-9]{2,5}$/.test(extension) ? extension : "jpg";
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

async function downloadToCache(
  mediaUrl: string,
  type: string,
): Promise<{ uri: string; mime: string } | null> {
  try {
    const response = await fetch(mediaUrl, { mode: "cors" });
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    if (!buffer.byteLength) return null;

    const mime = response.headers.get("content-type")?.split(";")[0].trim() || "";
    const extension = extensionForMedia(mime, mediaUrl);
    const safeType = type.toLowerCase().replace(/[^a-z0-9-]/g, "") || "post";
    const filename = `flicks-${safeType}-${Date.now()}.${extension}`;

    await Filesystem.writeFile({
      path: filename,
      data: arrayBufferToBase64(buffer),
      directory: Directory.Cache,
    });

    const { uri } = await Filesystem.getUri({
      path: filename,
      directory: Directory.Cache,
    });

    return { uri, mime };
  } catch {
    return null;
  }
}

function isCancelled(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === "AbortError";
}

/**
 * Share media through the Android OS sheet with a cache-backed content URI.
 * Returns unsupported everywhere except the native Android Capacitor build.
 */
export async function shareViaCapacitor(
  input: {
    title: string;
    text?: string | null;
    url: string;
    mediaUrl?: string | null;
    type?: string;
    appendPromoFooter?: boolean;
  },
): Promise<CapacitorShareOutcome> {
  if (Capacitor.getPlatform() !== "android") return "unsupported";

  const trimmedText = input.text?.trim() || "";
  const text = input.appendPromoFooter === false
    ? trimmedText
    : trimmedText
      ? `${trimmedText}\n\n${PROMO_FOOTER}`
      : PROMO_FOOTER;
  const cachedMedia = input.mediaUrl
    ? await downloadToCache(input.mediaUrl, input.type || "post")
    : null;

  try {
    await Share.share({
      title: input.title,
      text,
      url: input.url,
      ...(cachedMedia ? { files: [cachedMedia.uri] } : {}),
    });
    return cachedMedia ? "shared-with-file" : "shared-url-only";
  } catch (error) {
    if (isCancelled(error)) return "cancelled";
  }

  // If the file handoff failed, retain a useful text/URL share fallback.
  if (cachedMedia) {
    try {
      await Share.share({ title: input.title, text, url: input.url });
      return "shared-url-only";
    } catch (error) {
      if (isCancelled(error)) return "cancelled";
    }
  }

  return "error";
}