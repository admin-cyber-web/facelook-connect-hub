const CLOUDINARY_CLOUD_NAME = "dzlazqbvf";
const CLOUDINARY_UPLOAD_PRESET = "flicks_upload";

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
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  let payload: CloudinaryUploadResponse = {};
  try {
    payload = (await response.json()) as CloudinaryUploadResponse;
  } catch {
    // Keep the HTTP status as the useful error when Cloudinary returns no JSON.
  }

  if (!response.ok || !payload.secure_url) {
    throw new Error(
      payload.error?.message || `Cloudinary upload failed (${response.status})`,
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