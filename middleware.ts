import { next } from "@vercel/edge";
import { resolveSharePreviewUrl } from "./src/lib/universalShare";

export const config = {
  matcher: ["/post/:path*", "/"],
};

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";

const DEFAULT_IMAGE = "https://i.ibb.co/HT7RvFxs/flicksindia.png";
const SITE_URL = "https://flicksindia.online";
const BOT_PATTERN =
  /WhatsApp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|TelegramBot|Pinterest|Googlebot|Instagram|meta-externalagent|meta-externalfetcher/i;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function scriptString(value: string): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

async function fetchPublicRow(
  table: "posts" | "frame_requests",
  filter: string,
  fields: string,
): Promise<Record<string, any> | null> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?${filter}&select=${fields}&limit=1`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: "application/json",
      },
    },
  );
  if (!response.ok) return null;
  const rows: Record<string, any>[] = await response.json();
  return rows?.[0] ?? null;
}

export default async function middleware(request: Request): Promise<Response> {
  const userAgent = request.headers.get("user-agent") || "";
  if (!BOT_PATTERN.test(userAgent)) return next();

  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const postId = segments[0] === "post" ? segments[1] : undefined;
  const frameCode =
    url.pathname === "/" ? url.searchParams.get("frame")?.trim() : undefined;

  if (!postId && !frameCode) return next();

  try {
    let title = "";
    let description = "";
    let previewUrl: string | undefined;
    let canonicalUrl = "";

    if (postId) {
      const decodedId = decodeURIComponent(postId);
      const post = await fetchPublicRow(
        "posts",
        `id=eq.${encodeURIComponent(decodedId)}`,
        "id,content,media_url,image_url,image_urls,video_url,cover_url,media_type,type,metadata,author,meta_title,meta_description",
      );
      if (!post) return next();

      title =
        post.meta_title?.trim() ||
        post.content?.slice(0, 60).trim() ||
        "Flicks India Post";
      description =
        post.meta_description?.trim() ||
        post.content?.slice(0, 160).trim() ||
        "Check out this post on Flicks India.";
      previewUrl = resolveSharePreviewUrl(post);
      canonicalUrl = `${SITE_URL}/post/${encodeURIComponent(post.id)}`;
    } else if (frameCode) {
      const requestItem = await fetchPublicRow(
        "frame_requests",
        `request_code=eq.${encodeURIComponent(frameCode)}`,
        "id,request_code,needy_name,needy_photo_url,category,description",
      );
      if (!requestItem) return next();

      const needyName = requestItem.needy_name?.trim() || "someone in need";
      const category = requestItem.category?.trim();
      title = `Help ${needyName} — Flicks Frame`;
      description =
        requestItem.description?.trim() ||
        (category ? `Help with ${category} through Flicks Frame.` : "Help someone in need through Flicks Frame.");
      previewUrl = resolveSharePreviewUrl({
        type: "post",
        media_url: requestItem.needy_photo_url,
      });
      canonicalUrl = `${SITE_URL}/?frame=${encodeURIComponent(requestItem.request_code || frameCode)}`;
    }

    const safeTitle = escapeHtml(title);
    const safeDescription = escapeHtml(description);
    // The promotional image is reserved for genuinely media-free content.
    const safeImage = escapeHtml(previewUrl || DEFAULT_IMAGE);
    const safeUrl = escapeHtml(canonicalUrl);
    const redirect = scriptString(canonicalUrl);
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${safeTitle} | Flicks India</title>
  <meta name="description" content="${safeDescription}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Flicks India" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDescription}" />
  <meta property="og:image" content="${safeImage}" />
  <meta property="og:image:alt" content="${safeTitle}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${safeUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDescription}" />
  <meta name="twitter:image" content="${safeImage}" />
  <meta name="twitter:image:alt" content="${safeTitle}" />
  <link rel="canonical" href="${safeUrl}" />
  <noscript><meta http-equiv="refresh" content="0; url=${safeUrl}" /></noscript>
</head>
<body>
  <p>Loading… <a href="${safeUrl}">Open this on Flicks India</a></p>
  <script>window.location.replace(${redirect});</script>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch {
    return next();
  }
}
