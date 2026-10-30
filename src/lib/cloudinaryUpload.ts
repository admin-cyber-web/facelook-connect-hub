const CLOUDINARY_CLOUD_NAME =
  import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ?? "dzlazqbvf";
const CLOUDINARY_UPLOAD_PRESET =
  import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET ?? "flicks_upload";

// Maximum time (ms) to wait for a Cloudinary upload response before aborting.
const UPLOAD_TIMEOUT_MS = 60_000;

interface CloudinaryUploadResponse {
  secure_url?: string;
  public_id?: string;
  resource_type?: string;
  format?: string;
  bytes?: number;
  duration?: number;
  error?: {
    message?: string;
  };
}

export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId?: string;
  resourceType?: string;
  format?: string;
  bytes?: number;
  duration?: number;
}

interface CloudinaryUploadOptions {
  resourceType?: "auto" | "video";
  signal?: AbortSignal;
  timeoutMs?: number;
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  signal?: AbortSignal,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
  });
  const abort = signal
    ? new Promise<never>((_, reject) => {
        signal.addEventListener("abort", () =>
          reject(new Error("Upload aborted by caller")),
        );
      })
    : null;
  return Promise.race([promise, timeout, abort].filter(Boolean) as Promise<any>[]).then(
    (value) => {
      if (timeoutId) clearTimeout(timeoutId);
      return value;
    },
    (error) => {
      if (timeoutId) clearTimeout(timeoutId);
      throw error;
    },
  );
}

export async function uploadToCloudinaryDetailed(
  file: File,
  options: CloudinaryUploadOptions = {},
): Promise<CloudinaryUploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  // Cloudinary treats audio as a video resource. Using the video endpoint for
  // Reel audio also preserves duration/format metadata in the upload response.
  const resourceType =
    options.resourceType === "video" || file.type.startsWith("audio/")
      ? "video"
      : "auto";

  const controller = new AbortController();
  const combinedSignal =
    options.signal || controller.signal;
  const timeoutMs = options.timeoutMs ?? UPLOAD_TIMEOUT_MS;

  // Forward external abort signals to our internal controller.
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }
  }

  const response = await withTimeout(
    fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, {
      method: "POST",
      body: formData,
      signal: combinedSignal,
    }),
    timeoutMs,
    controller.signal,
  );

  controller.abort();

  let payload: CloudinaryUploadResponse = {};
  try {
    payload = (await response.json()) as CloudinaryUploadResponse;
  } catch {
    // Keep the HTTP status as the useful error when Cloudinary returns no JSON.
  }

  if (!response.ok || !payload.secure_url) {
    throw new Error(
      payload.error?.message ||
        `Cloudinary upload failed (${response.status}) for ${file.name}`,
    );
  }

  return {
    secureUrl: payload.secure_url,
    publicId: payload.public_id,
    resourceType: payload.resource_type,
    format: payload.format,
    bytes: payload.bytes,
    duration: payload.duration,
  };
}

export async function uploadToCloudinary(file: File): Promise<string> {
  const result = await uploadToCloudinaryDetailed(file);
  return result.secureUrl;
}