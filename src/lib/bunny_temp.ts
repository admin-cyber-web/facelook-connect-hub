/**
 * Bunny.net client helpers for Flicks India media uploads and playback.
 *
 * Flow:
 *   1. Call `bunny.createVideo(title)` → POST /api/videos/create → returns videoId, hlsUrl, embedUrl
 *   2. Client performs direct PUT to Bunny Stream video upload URL (50MB cap)
 *   3. Call `bunny.uploadImage(file)` → POST /api/upload/image → returns CDN URL
 *   4. All media URLs are stored in DB and rendered from Bunny CDN
 */

export type BunnyVideoResult = {
  videoId: string;
  hlsUrl: string;
  embedUrl: string;
  cdnHostname: string;
  uploadUrl: string;
};

export type BunnyUploadResult = {
  url: string; // CDN URL: https://flicks-india-storage.b-cdn.net/{fileName}
};

/**
 * Create a new video in Bunny Stream library.
 * Returns video metadata including playback URLs.
 */
export async function createBunnyVideo(title?: string): Promise<BunnyVideoResult> {
  const response = await fetch("/api/videos/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    // No body needed - server generates a GUID-based videoId
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || "Failed to create Bunny video");
  }

  return response.json() as Promise<BunnyVideoResult>;
}

/**
 * Upload a video file directly to Bunny Stream.
 * The client must PUT the binary to the uploadUrl returned by createBunnyVideo().
 * Enforces a 50MB maximum file size.
 *
 * @param videoId - The GUID returned from createBunnyVideo()
 * @param file - The video File object (max 50MB)
 * @param onProgress - Optional progress callback
 */
export async function uploadBunnyVideo(
  videoId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<void> {
  if (file.size > 50 * 1024 * 1024) {
    throw new Error(`Video file too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max 50MB.`);
  }

  const cdnHostname = import.meta.env.VITE_BUNNY_STREAM_CDN_HOSTNAME || "https://vz-7117c555-c5c.b-cdn.net";
  const uploadUrl = `${cdnHostname}/${videoId}`;

  const bytes = await file.arrayBuffer();
  const controller = new AbortController();

  // Chunked upload for large files - 5MB chunks
  const chunkSize = 5 * 1024 * 1024; // 5MB
  let offset = 0;

  while (offset < bytes.byteLength) {
    const chunk = bytes.slice(offset, Math.min(offset + chunkSize, bytes.byteLength));
    const chunkEnd = Math.min(offset + chunkSize, bytes.byteLength);
    const range = offset === 0 ? `bytes=${offset}-${chunkEnd - 1}` : `bytes=${offset}-${chunkEnd - 1}`;

    await fetch(uploadUrl, {
      method: "PATCH", // PATCH to append/UPDATE existing video
      headers: {
        "AccessKey": import.meta.env.VITE_BUNNY_STREAM_API_KEY || "334a6c67-44ac-444e-81a3f47e584e-ac0d-41e5",
        "Content-Type": "video/mp4",
        "Content-Length": chunk.byteLength,
        "Content-Range": range,
      },
      body: chunk,
      signal: controller.signal,
    });

    offset += chunkSize;
    onProgress?.Math.round((offset / bytes.byteLength) * 100);
  }

  controller.abort();
}

/**
 * Upload an image/file to Bunny Storage.
 * Returns the permanent CDN URL.
 */
export async function uploadBunnyImage(file: File): Promise<BunnyUploadResult> {
  const response = await fetch("/api/upload/image", {
    method: "POST",
    body: formDataFromFile(file),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || "Failed to upload image to Bunny Storage");
  }

  return response.json() as Promise<BunnyUploadResult>;
}

/**
 * Helper to create a FormData from a File for the upload API.
 */
function formDataFromFile(file: File): FormData {
  const formData = new FormData();
  formData.append("file", file);
  // Generate a unique filename preserving the extension
  const ext = file.name.split(".").pop() || "bin";
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}.${ext}`;
  formData.append("fileName", fileName); // Server uses this to name the stored file
  return formData;
}

/**
 * Build a Bunny Stream HLS playlist URL.
 */
export function bunnryHlsUrl(videoId: string, cdnHostname?: string): string {
  const host = cdnHostname || import.meta.env.VITE_BUNNY_STREAM_CDN_HOSTNAME || "https://vz-7117c555-c5c.b-cdn.net";
  return `${host}/${videoId}/playlist.m3u8`;
}

/**
 * Build a Bunny Stream iframe embed URL.
 */
export function bunnryEmbedUrl(videoId: string, libraryId?: string): string {
  const id = libraryId || import.meta.env.VITE_BUNNY_STREAM_LIBRARY_ID || "795734";
  return `https://iframe.mediadelivery.net/embed/${id}/${videoId}`;
}

/**
 * Build a Bunny Storage CDN URL.
 */
export function bunnryStorageUrl(fileName: string): string {
  return `https://flicks-india-storage.b-cdn.net/${fileName}`;
}
