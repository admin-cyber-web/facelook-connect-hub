/**
 * Bunny.net client helpers for Flicks India media uploads and playback.
 *
 * Flow:
 *   1. Call `bunny.uploadBunnyVideo(file)` → create a video and obtain a short-lived TUS signature
 *   2. Client uploads video chunks directly to Bunny Stream (50MB cap; API key stays server-side)
 *   3. Call `bunny.uploadImage(file)` → POST /api/upload/image → returns CDN URL
 *   4. All media URLs are stored in DB and rendered from Bunny CDN
 */

import { apiUrl } from "@/lib/apiUrl";

export type BunnyVideoResult = {
  videoId: string;
  libraryId: string;
  hlsUrl: string;
  embedUrl: string;
  cdnHostname: string;
  uploadUrl: string;
  authorizationSignature: string;
  authorizationExpire: number;
};

export type BunnyUploadResult = {
  url: string;
};

/**
 * Create a new video in Bunny Stream library.
 * Returns video metadata including playback URLs.
 */
export async function createBunnyVideo(title?: string): Promise<BunnyVideoResult> {
  const response = await fetch(apiUrl("/api/videos/create"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Failed to create Bunny video");
  }

  return response.json() as Promise<BunnyVideoResult>;
}

/**
 * Create and upload a video file directly to Bunny Stream using signed TUS authorization.
 * Enforces a 50MB maximum file size before creating the Bunny video.
 *
 * @param file - The video File object (max 50MB)
 * @param onProgress - Optional progress callback
 */
export async function uploadBunnyVideo(
  file: File,
  onProgress?: (progress: number) => void
): Promise<BunnyVideoResult> {
  if (file.size === 0) {
    throw new Error("Video file is empty.");
  }
  if (file.size > 50 * 1024 * 1024) {
    throw new Error(`Video file too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max 50MB.`);
  }

  const video = await createBunnyVideo(file.name);
  if (!/^\d+$/.test(video.libraryId)) {
    throw new Error("Bunny Stream returned a missing or invalid library ID.");
  }
  if (!video.videoId || !video.authorizationSignature || !video.authorizationExpire || !video.uploadUrl) {
    throw new Error("Bunny Stream returned incomplete upload authorization details.");
  }

  const authorizationHeaders = {
    "AuthorizationSignature": video.authorizationSignature,
    "AuthorizationExpire": String(video.authorizationExpire),
    "LibraryId": video.libraryId,
    "VideoId": video.videoId,
    "Tus-Resumable": "1.0.0",
  };
  const metadata = [
    `filetype ${encodeBase64(file.type || "application/octet-stream")}`,
    `title ${encodeBase64(file.name)}`,
  ].join(",");
  const createResponse = await fetch(video.uploadUrl, {
    method: "POST",
    headers: {
      ...authorizationHeaders,
      "Upload-Length": String(file.size),
      "Upload-Metadata": metadata,
    },
  });

  if (!createResponse.ok) {
    const message = await createResponse.text();
    throw new Error(`Bunny Stream upload initialization failed (${createResponse.status}): ${message}`);
  }

  const location = createResponse.headers.get("Location");
  if (!location) {
    throw new Error("Bunny Stream did not return an upload location.");
  }
  const uploadUrl = new URL(location, video.uploadUrl).toString();
  const chunkSize = 5 * 1024 * 1024; // 5MB
  let offset = 0;

  while (offset < file.size) {
    const chunkEnd = Math.min(offset + chunkSize, file.size);
    const response = await fetch(uploadUrl, {
      method: "PATCH", // PATCH to append/UPDATE existing video
      headers: {
        ...authorizationHeaders,
        "Upload-Offset": String(offset),
        "Content-Type": "application/offset+octet-stream",
      },
      body: file.slice(offset, chunkEnd),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Bunny Stream upload failed (${response.status}): ${message}`);
    }

    const nextOffset = Number(response.headers.get("Upload-Offset"));
    if (!Number.isFinite(nextOffset) || nextOffset !== chunkEnd) {
      throw new Error("Bunny Stream returned an invalid upload offset.");
    }
    offset = nextOffset;
    onProgress?.(Math.round((offset / file.size) * 100));
  }
  return video;
}

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

/**
 * Upload an image/file to Bunny Storage.
 * Returns the permanent CDN URL.
 */
export async function uploadBunnyImage(file: File): Promise<BunnyUploadResult> {
  const response = await fetch(apiUrl("/api/upload/image"), {
    method: "POST",
    body: formDataFromFile(file),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Failed to upload image to Bunny Storage");
  }

  return response.json() as Promise<BunnyUploadResult>;
}

/**
 * Helper to create a FormData from a File for the upload API.
 */
function formDataFromFile(file: File): FormData {
  const formData = new FormData();
  formData.append("file", file);
  const ext = file.name.split(".").pop() || "bin";
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}.${ext}`;
  formData.append("fileName", fileName);
  return formData;
}

/**
 * Build a Bunny Stream HLS playlist URL.
 */
export function bunnyHlsUrl(videoId: string, cdnHostname?: string): string {
  const host = (cdnHostname || "https://vz-7117c555-c5c.b-cdn.net").replace(/\/+$/, "");
  return `${host}/${videoId}/playlist.m3u8`;
}

/**
 * Build a Bunny Stream iframe embed URL.
 */
export function bunnyEmbedUrl(videoId: string, libraryId?: string): string {
  const id = libraryId || "795734";
  return `https://iframe.mediadelivery.net/embed/${id}/${videoId}`;
}

/**
 * Build a Bunny Storage CDN URL.
 */
export function bunnyStorageUrl(fileName: string): string {
  return `https://flicksindiacdn.b-cdn.net/${fileName}`;
}

/**
 * BunnyCDN pull zone base URL for sticker packs.
 */
export const BUNNY_CDN_BASE = "https://flicksindiacdn.b-cdn.net";

/**
 * Explicit sticker pack category folder URLs on the pull zone.
 */
export const BUNNY_STICKER_CATEGORY_URLS: Record<StickerPackCategory, string> = {
  Love: `${BUNNY_CDN_BASE}/Love/`,
  Sad: `${BUNNY_CDN_BASE}/Sad/`,
  emotional: `${BUNNY_CDN_BASE}/emotional/`,
  Angry: `${BUNNY_CDN_BASE}/Angry/`,
};

/**
 * Sticker pack category folders available on the pull zone.
 */
export type StickerPackCategory = "Love" | "Sad" | "emotional" | "Angry";

/**
 * Build a full sticker pack image URL from a category folder and file name.
 *
 * Example:
 *   bunnyStickerUrl("Love", "heart.png")
 *   → "https://flicksindiacdn.b-cdn.net/Love/heart.png"
 *
 * @param category - One of "Love" | "Sad" | "emotional" | "Angry"
 * @param fileName - Image file name inside the category folder
 */
export function bunnyStickerUrl(category: StickerPackCategory, fileName: string): string {
  const cat = String(category).replace(/^\/+|\/+$/g, "");
  const file = String(fileName).replace(/^\/+/, "");
  return `${BUNNY_CDN_BASE}/${cat}/${file}`;
}