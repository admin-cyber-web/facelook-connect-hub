import { next } from "@vercel/edge";

export const config = {
  matcher: "/post/:path*",
};

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";

const DEFAULT_IMAGE = "https://i.ibb.co/HT7RvFxs/flicksindia.png";
const SITE_URL = "https://flicksindia.online";

const BOT_PATTERN =
  /WhatsApp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|TelegramBot|Pinterest|Googlebot/i;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default async function middleware(request: Request): Promise<Response> {
  const userAgent = request.headers.get("user-agent") || "";
  const url = new URL(request.url);

  const isBot = BOT_PATTERN.test(userAgent);
  if (!isBot) {
    return next();
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const postId = segments[1];

  if (!postId) return next();

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(postId)}&select=id,content,media_url,cover_url,author&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Accept: "application/json",
        },
      },
    );

    if (!res.ok) return next();

    const rows: any[] = await res.json();
    const post = rows?.[0];

    if (!post) return next();

    const rawTitle = (post.content || "").slice(0, 50).trim();
    const ogTitle = escapeHtml(rawTitle || "Flicks India Post");
    const rawDesc = (post.content || "").slice(0, 160).trim();
    const ogDescription = escapeHtml(
      rawDesc || "Check out this post on Flicks India.",
    );
    const ogImage = escapeHtml(post.media_url || post.cover_url || DEFAULT_IMAGE);
    const ogUrl = escapeHtml(`${SITE_URL}/post/${post.id}`);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${ogTitle} | Flicks India</title>
  <meta name="description" content="${ogDescription}" />

  <!-- Open Graph -->
  <meta property="og:type"        content="article" />
  <meta property="og:site_name"   content="Flicks India" />
  <meta property="og:title"       content="${ogTitle}" />
  <meta property="og:description" content="${ogDescription}" />
  <meta property="og:image"       content="${ogImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url"         content="${ogUrl}" />

  <!-- Twitter -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${ogTitle}" />
  <meta name="twitter:description" content="${ogDescription}" />
  <meta name="twitter:image"       content="${ogImage}" />

  <!-- Redirect browsers (not bots) to the SPA -->
  <noscript><meta http-equiv="refresh" content="0; url=${ogUrl}" /></noscript>
</head>
<body>
  <p>Loading post… <a href="${ogUrl}">Click here if not redirected.</a></p>
  <script>window.location.href = "${ogUrl}";</script>
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
