const SITE_URL = "https://flicksindia.online";
const DEFAULT_IMAGE = "https://i.ibb.co/HT7RvFxs/flicksindia.png";
const BOT_PATTERN =
  /WhatsApp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|TelegramBot|Pinterest|Googlebot|Instagram|meta-externalagent|meta-externalfetcher/i;

type ShareMetadataEnvironment = {
  VITE_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  SUPABASE_ANON_KEY?: string;
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function absoluteHttpUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function isStaticAppImage(value: string): boolean {
  try {
    const image = new URL(value);
    const fallback = new URL(DEFAULT_IMAGE);
    return (
      (image.hostname === fallback.hostname && image.pathname === fallback.pathname) ||
      (image.hostname.toLowerCase() === "flicksindia.online" &&
        ["/logo.png", "/app-icon.png"].includes(image.pathname.toLowerCase()))
    );
  } catch {
    return false;
  }
}

function firstMediaUrl(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string") {
      const candidate = value.trim();
      if (!candidate) continue;
      if (candidate.startsWith("[") || candidate.startsWith("{")) {
        try {
          const nested = firstMediaUrl(JSON.parse(candidate));
          if (nested) return nested;
          continue;
        } catch {
          // A malformed JSON-like value may still be a literal URL.
        }
      }
      const firstUrl = candidate.split(/,(?=https?:\/\/)/, 1)[0]?.trim();
      if (firstUrl && !isStaticAppImage(firstUrl)) return firstUrl;
      continue;
    }

    if (Array.isArray(value)) {
      const nested = firstMediaUrl(...value);
      if (nested) return nested;
      continue;
    }

    if (value && typeof value === "object") {
      const item = value as Record<string, unknown>;
      const nested = firstMediaUrl(
        item.url,
        item.secure_url,
        item.publicUrl,
        item.image_url,
        item.media_url,
        item.video_url,
      );
      if (nested) return nested;
    }
  }
  return undefined;
}

function metadataOf(post: Record<string, any>): Record<string, any> {
  if (post.metadata && typeof post.metadata === "object") return post.metadata;
  if (typeof post.metadata === "string") {
    try {
      const parsed = JSON.parse(post.metadata);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function cloudinaryVideoPoster(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const videoUrl = new URL(value);
    if (!videoUrl.hostname.endsWith("cloudinary.com")) return undefined;

    const marker = "/video/upload/";
    const uploadIndex = videoUrl.pathname.indexOf(marker);
    if (uploadIndex < 0) return undefined;

    const beforeUpload = videoUrl.pathname.slice(0, uploadIndex + marker.length);
    const uploadPath = videoUrl.pathname.slice(uploadIndex + marker.length);
    const withPosterFrame = uploadPath.startsWith("so_0/")
      ? uploadPath
      : `so_0/${uploadPath}`;
    const imagePath = withPosterFrame.replace(
      /\.(?:mp4|m4v|mov|webm|ogg|m3u8)$/i,
      ".jpg",
    );
    videoUrl.pathname = `${beforeUpload}${imagePath}`;
    videoUrl.search = "";
    return videoUrl.toString();
  } catch {
    return undefined;
  }
}

function resolveSocialImage(post: Record<string, any>): string | undefined {
  const metadata = metadataOf(post);
  const videoSource = firstMediaUrl(
    post.video_url,
    metadata.video_url,
    metadata.videoUrl,
    post.media_url,
    metadata.media_url,
    metadata.mediaUrl,
  );
  const isVideo =
    ["reel", "video"].includes(String(post.type || "").toLowerCase()) ||
    metadata.is_video === true ||
    metadata.isVideo === true ||
    !!videoSource && /\/video\/upload\/|\.(?:mp4|m4v|mov|webm|ogg|m3u8)(?:[?#]|$)/i.test(videoSource);
  const previewCandidates = [
    post.preview_url,
    post.video_thumbnail_url,
    post.thumbnail_url,
    post.thumb_url,
    post.poster_url,
    post.cover_url,
    metadata.preview_url,
    metadata.previewUrl,
    metadata.video_thumbnail_url,
    metadata.videoThumbnailUrl,
    metadata.thumbnail_url,
    metadata.thumbnailUrl,
    metadata.thumb_url,
    metadata.thumbUrl,
    metadata.poster_url,
    metadata.posterUrl,
    metadata.cover_url,
    metadata.coverUrl,
  ];
  const imageCandidates = [
    post.image_url,
    post.image_urls,
    metadata.image_url,
    metadata.imageUrl,
    metadata.image_urls,
    metadata.imageUrls,
  ];
  const videoCandidates = [
    post.video_url,
    metadata.video_url,
    metadata.videoUrl,
  ];
  const mediaCandidates = [
    post.media_url,
    metadata.media_url,
    metadata.mediaUrl,
  ];
  const previewUrl = absoluteHttpUrl(
    firstMediaUrl(
      ...(isVideo
        ? [...previewCandidates, ...imageCandidates, ...videoCandidates, ...mediaCandidates]
        : [...imageCandidates, ...mediaCandidates, ...previewCandidates, ...videoCandidates]),
    ),
  );
  if (!previewUrl) return undefined;

  if (/\/video\/upload\/|\.(?:mp4|m4v|mov|webm|ogg|m3u8)(?:[?#]|$)/i.test(previewUrl)) {
    return cloudinaryVideoPoster(previewUrl) || previewUrl;
  }
  return previewUrl;
}

async function fetchPublicRow(
  supabaseUrl: string,
  anonKey: string,
  table: "posts" | "frame_requests",
  filters: Record<string, string>,
  fields: string,
): Promise<Record<string, any> | null> {
  const endpoint = new URL(`/rest/v1/${table}`, supabaseUrl);
  endpoint.searchParams.set("select", fields);
  endpoint.searchParams.set("limit", "1");
  for (const [key, value] of Object.entries(filters)) {
    endpoint.searchParams.set(key, value);
  }

  const response = await fetch(endpoint, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) return null;

  const rows = (await response.json()) as Record<string, any>[];
  return rows?.[0] ?? null;
}

/**
 * Return crawler-ready HTML for a post or Flicks Frame request.
 * Return null for ordinary visitors or unknown URLs so the SPA can serve them.
 */
export async function createDynamicShareResponse(
  requestUrl: string,
  userAgent: string,
  environment: ShareMetadataEnvironment = {},
): Promise<Response | null> {
  if (!BOT_PATTERN.test(userAgent)) return null;

  let url: URL;
  try {
    url = new URL(requestUrl, SITE_URL);
  } catch {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const postId = segments[0] === "post" ? segments[1] : undefined;
  const frameCode =
    url.pathname === "/" ? url.searchParams.get("frame")?.trim() : undefined;
  if (!postId && !frameCode) return null;

  const supabaseUrl =
    environment.VITE_SUPABASE_URL || environment.SUPABASE_URL || "";
  const anonKey =
    environment.VITE_SUPABASE_ANON_KEY ||
    environment.SUPABASE_ANON_KEY ||
    "";
  if (!supabaseUrl || !anonKey) return null;

  try {
    let title: string;
    let description: string;
    let imageUrl: string | undefined;
    let canonicalUrl: string;

    if (postId) {
      const decodedId = decodeURIComponent(postId);
      const post = await fetchPublicRow(
        supabaseUrl,
        anonKey,
        "posts",
        { id: `eq.${decodedId}` },
        "id,content,media_url,image_urls,cover_url,type,metadata,author",
      );
      if (!post) return null;

      title =
        String(post.content || "").slice(0, 60).trim() ||
        "Flicks India Post";
      description =
        String(post.content || "").slice(0, 160).trim() ||
        "Check out this post on Flicks India.";
      imageUrl = resolveSocialImage(post);
      canonicalUrl = `${SITE_URL}/post/${encodeURIComponent(post.id)}`;
    } else {
      const requestItem = await fetchPublicRow(
        supabaseUrl,
        anonKey,
        "frame_requests",
        { request_code: `eq.${frameCode}` },
        "id,request_code,needy_name,needy_photo_url,category,description",
      );
      if (!requestItem) return null;

      const needyName = String(requestItem.needy_name || "").trim() || "someone in need";
      const category = String(requestItem.category || "").trim();
      title = `Help ${needyName} — Flicks Frame`;
      description =
        String(requestItem.description || "").trim() ||
        (category
          ? `Help with ${category} through Flicks Frame.`
          : "Help someone in need through Flicks Frame.");
      imageUrl = resolveSocialImage({
        type: "post",
        media_url: requestItem.needy_photo_url,
      });
      canonicalUrl = `${SITE_URL}/?frame=${encodeURIComponent(requestItem.request_code || frameCode)}`;
    }

    const safeTitle = escapeHtml(title);
    const safeDescription = escapeHtml(description);
    // Use the app banner only when this shared item has no usable media URL.
    const safeImage = escapeHtml(imageUrl || DEFAULT_IMAGE);
    const safeCanonicalUrl = escapeHtml(canonicalUrl);
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle} | Flicks India</title>
  <meta name="description" content="${safeDescription}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Flicks India" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDescription}" />
  <meta property="og:image" content="${safeImage}" />
  <meta property="og:image:secure_url" content="${safeImage}" />
  <meta property="og:image:alt" content="${safeTitle}" />
  <meta property="og:url" content="${safeCanonicalUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDescription}" />
  <meta name="twitter:image" content="${safeImage}" />
  <meta property="twitter:image" content="${safeImage}" />
  <link rel="canonical" href="${safeCanonicalUrl}" />
</head>
<body>
  <main>
    <h1>${safeTitle}</h1>
    <p>${safeDescription}</p>
    <a href="${safeCanonicalUrl}">Open on Flicks India</a>
  </main>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("[share-metadata] render failed:", error);
    return null;
  }
}
