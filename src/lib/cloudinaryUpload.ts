const CLOUDINARY_CLOUD_NAME = "dzlazqbvf";
const CLOUDINARY_UPLOAD_PRESET = "flicks_upload";

interface CloudinaryUploadResponse {
  secure_url?: string;
  error?: {
    message?: string;
  };
}

export async function uploadToCloudinary(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
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

  return payload.secure_url;
}