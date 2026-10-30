/**
 * Cloudinary URL helper:
 * - Ensures new uploads use the new cloud name 'zl4mmmxm' (via env var)
 * - Provides a replacement function to migrate old URLs from 'dzlazqbvf' -> 'zl4mmmxm'
 * - Used by old database entries to avoid 401 errors without breaking existing display
 */

/**
 * Replace the Cloudinary cloud name in a URL from old to new.
 * If the URL already uses the new cloud name or is not a Cloudinary URL, it returns the URL unchanged.
 */
export function replaceCloudinaryCloudName(url: string): string {
  const OLD_CLOUD_NAME = "dzlazqbvf";
  const NEW_CLOUD_NAME = "zl4mmmxm";

  // Check if this is a Cloudinary URL
  const isCloudinaryUrl = typeof url === "string" && /^https?:\/\/(?:res\.)?cloudinary\.com\//i.test(url);

  if (!isCloudinaryUrl) {
    return url;
  }

  // Replace the old cloud name with the new one
  // Match: res.cloudinary.com/OLD_NAME/ or cloudinary.com/OLD_NAME/
  const updatedUrl = url.replace(
    new RegExp(`(?:res\\.)?cloudinary\\.com/${OLD_CLOUD_NAME}`, "i"),
    `cloudinary.com/${NEW_CLOUD_NAME}`
  );

  return updatedUrl;
}

/**
 * Parse a Cloudinary secure URL and ensure it uses the new cloud name.
 * Returns the modified URL string.
 */
export function ensureNewCloudNameInUrl(url: string): string {
  return replaceCloudinaryCloudName(url);
}

/**
 * Given a Cloudinary public_id or full URL, return a URL that uses the new cloud name.
 * If input is already a full URL, it will replace the cloud name.
 * If input is just a public_id, it constructs a URL with the new cloud name.
 */
export function getCloudinaryUrlWithNewCloudName(
  publicIdOrUrl: string,
  resourceType: "image" | "video" = "image"
): string {
  const baseUrl = `https://res.cloudinary.com/zl4mmmxm/${resourceType}/upload`;

  // If it's already a full URL with a cloud name, replace it
  if (ensureNewCloudNameInUrl(publicIdOrUrl) !== publicIdOrUrl) {
    // It's a full URL - just return the replaced version
    return ensureNewCloudNameInUrl(publicIdOrUrl);
  }

  // It looks like a public_id - construct a URL
  // Strip leading slash if present
  const cleanId = publicIdOrUrl.replace(/^\/+/, "");
  return `${baseUrl}/${cleanId}`;
}

/**
 * Batch-replace Cloudinary cloud names in an array of URLs.
 */
export function batchReplaceCloudinaryCloudNames(urls: string[]): string[] {
  return urls.map((url) => replaceCloudinaryCloudName(url));
}

export type { replaceCloudinaryCloudName, ensureNewCloudNameInUrl, getCloudinaryUrlWithNewCloudName, batchReplaceCloudinaryCloudNames };