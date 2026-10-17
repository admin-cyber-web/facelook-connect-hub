// vite.config.ts
import { defineConfig } from "file:///home/runner/workspace/node_modules/vite/dist/node/index.js";
import react from "file:///home/runner/workspace/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import fs from "fs";

// src/lib/serverShareMetadata.ts
var SITE_URL = "https://flicksindia.online";
var DEFAULT_IMAGE = "https://i.ibb.co/HT7RvFxs/flicksindia.png";
var BOT_PATTERN = /WhatsApp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|TelegramBot|Pinterest|Googlebot|Instagram|meta-externalagent|meta-externalfetcher/i;
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function absoluteHttpUrl(value) {
  if (!value) return void 0;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : void 0;
  } catch {
    return void 0;
  }
}
function isStaticAppImage(value) {
  try {
    const image = new URL(value);
    const fallback = new URL(DEFAULT_IMAGE);
    return image.hostname === fallback.hostname && image.pathname === fallback.pathname || image.hostname.toLowerCase() === "flicksindia.online" && ["/logo.png", "/app-icon.png"].includes(image.pathname.toLowerCase());
  } catch {
    return false;
  }
}
function firstMediaUrl(...values) {
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
      const item = value;
      const nested = firstMediaUrl(
        item.url,
        item.secure_url,
        item.publicUrl,
        item.image_url,
        item.media_url,
        item.video_url
      );
      if (nested) return nested;
    }
  }
  return void 0;
}
function metadataOf(post) {
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
function cloudinaryVideoPoster(value) {
  if (!value) return void 0;
  try {
    const videoUrl = new URL(value);
    if (!videoUrl.hostname.endsWith("cloudinary.com")) return void 0;
    const marker = "/video/upload/";
    const uploadIndex = videoUrl.pathname.indexOf(marker);
    if (uploadIndex < 0) return void 0;
    const beforeUpload = videoUrl.pathname.slice(0, uploadIndex + marker.length);
    const uploadPath = videoUrl.pathname.slice(uploadIndex + marker.length);
    const withPosterFrame = uploadPath.startsWith("so_0/") ? uploadPath : `so_0/${uploadPath}`;
    const imagePath = withPosterFrame.replace(
      /\.(?:mp4|m4v|mov|webm|ogg|m3u8)$/i,
      ".jpg"
    );
    videoUrl.pathname = `${beforeUpload}${imagePath}`;
    videoUrl.search = "";
    return videoUrl.toString();
  } catch {
    return void 0;
  }
}
function resolveSocialImage(post) {
  const metadata = metadataOf(post);
  const videoSource = firstMediaUrl(
    post.video_url,
    metadata.video_url,
    metadata.videoUrl,
    post.media_url,
    metadata.media_url,
    metadata.mediaUrl
  );
  const isVideo = ["reel", "video"].includes(String(post.type || "").toLowerCase()) || metadata.is_video === true || metadata.isVideo === true || !!videoSource && /\/video\/upload\/|\.(?:mp4|m4v|mov|webm|ogg|m3u8)(?:[?#]|$)/i.test(videoSource);
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
    metadata.coverUrl
  ];
  const imageCandidates = [
    post.image_url,
    post.image_urls,
    metadata.image_url,
    metadata.imageUrl,
    metadata.image_urls,
    metadata.imageUrls
  ];
  const videoCandidates = [
    post.video_url,
    metadata.video_url,
    metadata.videoUrl
  ];
  const mediaCandidates = [
    post.media_url,
    metadata.media_url,
    metadata.mediaUrl
  ];
  const previewUrl = absoluteHttpUrl(
    firstMediaUrl(
      ...isVideo ? [...previewCandidates, ...imageCandidates, ...videoCandidates, ...mediaCandidates] : [...imageCandidates, ...mediaCandidates, ...previewCandidates, ...videoCandidates]
    )
  );
  if (!previewUrl) return void 0;
  if (/\/video\/upload\/|\.(?:mp4|m4v|mov|webm|ogg|m3u8)(?:[?#]|$)/i.test(previewUrl)) {
    return cloudinaryVideoPoster(previewUrl) || previewUrl;
  }
  return previewUrl;
}
async function fetchPublicRow(supabaseUrl, anonKey, table, filters, fields) {
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
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(5e3)
  });
  if (!response.ok) return null;
  const rows = await response.json();
  return rows?.[0] ?? null;
}
async function createDynamicShareResponse(requestUrl, userAgent, environment = {}) {
  if (!BOT_PATTERN.test(userAgent)) return null;
  let url;
  try {
    url = new URL(requestUrl, SITE_URL);
  } catch {
    return null;
  }
  const segments = url.pathname.split("/").filter(Boolean);
  const postId = segments[0] === "post" ? segments[1] : void 0;
  const frameCode = url.pathname === "/" ? url.searchParams.get("frame")?.trim() : void 0;
  if (!postId && !frameCode) return null;
  const supabaseUrl = environment.VITE_SUPABASE_URL || environment.SUPABASE_URL || "";
  const anonKey = environment.VITE_SUPABASE_ANON_KEY || environment.SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !anonKey) return null;
  try {
    let title;
    let description;
    let imageUrl;
    let canonicalUrl;
    if (postId) {
      const decodedId = decodeURIComponent(postId);
      const post = await fetchPublicRow(
        supabaseUrl,
        anonKey,
        "posts",
        { id: `eq.${decodedId}` },
        "id,content,media_url,image_urls,cover_url,type,metadata,author"
      );
      if (!post) return null;
      title = String(post.content || "").slice(0, 60).trim() || "Flicks India Post";
      description = String(post.content || "").slice(0, 160).trim() || "Check out this post on Flicks India.";
      imageUrl = resolveSocialImage(post);
      canonicalUrl = `${SITE_URL}/post/${encodeURIComponent(post.id)}`;
    } else {
      const requestItem = await fetchPublicRow(
        supabaseUrl,
        anonKey,
        "frame_requests",
        { request_code: `eq.${frameCode}` },
        "id,request_code,needy_name,needy_photo_url,category,description"
      );
      if (!requestItem) return null;
      const needyName = String(requestItem.needy_name || "").trim() || "someone in need";
      const category = String(requestItem.category || "").trim();
      title = `Help ${needyName} \u2014 Flicks Frame`;
      description = String(requestItem.description || "").trim() || (category ? `Help with ${category} through Flicks Frame.` : "Help someone in need through Flicks Frame.");
      imageUrl = resolveSocialImage({
        type: "post",
        media_url: requestItem.needy_photo_url
      });
      canonicalUrl = `${SITE_URL}/?frame=${encodeURIComponent(requestItem.request_code || frameCode)}`;
    }
    const safeTitle = escapeHtml(title);
    const safeDescription = escapeHtml(description);
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
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300"
      }
    });
  } catch (error) {
    console.error("[share-metadata] render failed:", error);
    return null;
  }
}

// vite.config.ts
var __vite_injected_original_dirname = "/home/runner/workspace";
function sitemapPlugin() {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
  const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
  const BASE_URL = "https://flicksindia.online";
  const PAGE_SIZE = 1e3;
  const MAX_DYNAMIC_URLS = 49999;
  const TTL_MS = 60 * 60 * 1e3;
  let cache = null;
  async function buildSitemapXml() {
    const { createClient } = await import("file:///home/runner/workspace/node_modules/@supabase/supabase-js/dist/index.mjs");
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    });
    const rows = [];
    let from = 0;
    while (rows.length < MAX_DYNAMIC_URLS) {
      const pageSize = Math.min(PAGE_SIZE, MAX_DYNAMIC_URLS - rows.length);
      const { data, error } = await sb.from("posts").select("id, updated_at, created_at").eq("visibility", "public").order("created_at", { ascending: false }).range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data) throw new Error("Supabase returned no sitemap page data");
      if (data.length === 0) break;
      rows.push(...data);
      if (data.length < pageSize) break;
      from += data.length;
    }
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const d = (raw) => {
      try {
        return new Date(raw).toISOString().split("T")[0];
      } catch {
        return (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      }
    };
    const urlEntries = rows.map(
      (r) => `  <url>
    <loc>${esc(`${BASE_URL}/post/${r.id}`)}</loc>
    <lastmod>${d(r.updated_at || r.created_at)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
    ).join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${esc(BASE_URL)}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
` + (urlEntries ? urlEntries + "\n" : "") + `</urlset>
`;
  }
  function attachSitemapHandler(middlewares) {
    middlewares.use(
      "/sitemap.xml",
      async (req, res, next) => {
        const now = Date.now();
        if (cache && now - cache.builtAt < TTL_MS) {
          res.setHeader("Content-Type", "application/xml; charset=utf-8");
          res.setHeader("Cache-Control", "public, max-age=3600");
          res.setHeader("X-Sitemap-Cache", "HIT");
          res.statusCode = 200;
          res.end(cache.xml);
          return;
        }
        const staticPath = path.resolve(__vite_injected_original_dirname, "public", "sitemap.xml");
        if (fs.existsSync(staticPath)) {
          const xml = fs.readFileSync(staticPath, "utf8");
          cache = { xml, builtAt: now };
          res.setHeader("Content-Type", "application/xml; charset=utf-8");
          res.setHeader("Cache-Control", "public, max-age=3600");
          res.setHeader("X-Sitemap-Cache", "FILE");
          res.statusCode = 200;
          res.end(xml);
          return;
        }
        try {
          const xml = await buildSitemapXml();
          cache = { xml, builtAt: now };
          res.setHeader("Content-Type", "application/xml; charset=utf-8");
          res.setHeader("Cache-Control", "public, max-age=3600");
          res.setHeader("X-Sitemap-Cache", "LIVE");
          res.statusCode = 200;
          res.end(xml);
        } catch (err) {
          console.error("[sitemap] generation failed:", err);
          next();
        }
      }
    );
  }
  return {
    name: "flicks-sitemap",
    configureServer(server) {
      attachSitemapHandler(server.middlewares);
    },
    configurePreviewServer(server) {
      attachSitemapHandler(server.middlewares);
    }
  };
}
function socialShareMetadataPlugin() {
  function attachShareMetadataHandler(middlewares) {
    middlewares.use(async (req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        next();
        return;
      }
      try {
        const requestUrl = new URL(req.url || "/", "http://localhost").toString();
        const response = await createDynamicShareResponse(
          requestUrl,
          String(req.headers?.["user-agent"] || ""),
          process.env
        );
        if (!response) {
          next();
          return;
        }
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(req.method === "HEAD" ? void 0 : await response.text());
      } catch (error) {
        console.error("[share-metadata] request failed:", error);
        next();
      }
    });
  }
  return {
    name: "flicks-social-share-metadata",
    configureServer(server) {
      attachShareMetadataHandler(server.middlewares);
    },
    configurePreviewServer(server) {
      attachShareMetadataHandler(server.middlewares);
    }
  };
}
function apkDownloadPlugin() {
  const candidates = [
    path.resolve(__vite_injected_original_dirname, "app-release-signed.apk"),
    path.resolve(__vite_injected_original_dirname, "public", "app.apk")
  ];
  function attachApkHandler(middlewares) {
    middlewares.use("/download/apk", (req, res, next) => {
      const apkPath = candidates.find(fs.existsSync);
      if (!apkPath) {
        res.statusCode = 404;
        res.end("APK not found on disk.");
        return;
      }
      const stat = fs.statSync(apkPath);
      res.setHeader("Content-Type", "application/vnd.android.package-archive");
      res.setHeader("Content-Disposition", 'attachment; filename="FlicksIndia.apk"');
      res.setHeader("Content-Length", stat.size);
      res.setHeader("Cache-Control", "no-store");
      res.statusCode = 200;
      fs.createReadStream(apkPath).pipe(res);
    });
  }
  return {
    name: "flicks-apk-download",
    configureServer(server) {
      attachApkHandler(server.middlewares);
    },
    configurePreviewServer(server) {
      attachApkHandler(server.middlewares);
    }
  };
}
var vite_config_default = defineConfig({
  base: "/",
  server: {
    host: "0.0.0.0",
    port: 5e3,
    allowedHosts: true,
    hmr: { overlay: false },
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    }
  },
  preview: {
    host: "0.0.0.0",
    port: 5e3,
    allowedHosts: true
  },
  plugins: [react(), socialShareMetadataPlugin(), sitemapPlugin(), apkDownloadPlugin()],
  resolve: {
    alias: { "@": path.resolve(__vite_injected_original_dirname, "./src") },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime"
    ]
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    minify: "esbuild",
    cssMinify: "esbuild",
    reportCompressedSize: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      external: ["onnxruntime-web", "onnxruntime-web/webgpu", "@imgly/background-removal", "@google/generative-ai"],
      onwarn(warning, warn) {
        if (warning.code === "CIRCULAR_DEPENDENCY") {
          console.error("\u{1F534} CIRCULAR:", warning.message);
          return;
        }
        warn(warning);
      },
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/") || id.includes("node_modules/scheduler/"))
            return "vendor-react";
          if (id.includes("node_modules/framer-motion")) return "vendor-framer";
          if (id.includes("node_modules/lucide-react")) return "vendor-lucide";
          if (id.includes("node_modules/@supabase")) return "vendor-supabase";
          if (id.includes("node_modules/@tanstack")) return "vendor-query";
          if (id.includes("node_modules/@radix-ui") || id.includes("node_modules/cmdk"))
            return "vendor-ui";
          if (id.includes("node_modules/react-router") || id.includes("node_modules/wouter"))
            return "vendor-router";
          if (id.includes("node_modules/@imgly") || id.includes("node_modules/onnxruntime") || id.includes("node_modules/onnx"))
            return "vendor-onnx";
          if (id.includes("node_modules/agora") || id.includes("node_modules/agora-rtc"))
            return "vendor-agora";
          if (id.includes("node_modules/react-icons")) return "vendor-icons";
          if (id.includes("node_modules/")) return "vendor-misc";
          if (id.includes("/src/lib/supabaseClient")) return "app-supabase";
          if (id.includes("/src/lib/adminConfig")) return "app-admin";
          if (id.includes("/src/lib/mentions")) return "app-mentions";
          if (id.includes("/src/lib/sharePost")) return "app-share";
          if (id.includes("/src/context/")) return "app-context";
          if (id.includes("/src/hooks/")) return "app-hooks";
          if (id.includes("/src/components/ErrorBoundary")) return "app-error-boundary";
          if (id.includes("/src/components/AutoPlayMutedVideo")) return "app-autoplay";
          if (id.includes("/src/components/RichCaption")) return "app-rich-caption";
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAic3JjL2xpYi9zZXJ2ZXJTaGFyZU1ldGFkYXRhLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL2hvbWUvcnVubmVyL3dvcmtzcGFjZVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2hvbWUvcnVubmVyL3dvcmtzcGFjZS92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vaG9tZS9ydW5uZXIvd29ya3NwYWNlL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBQbHVnaW4gfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG5pbXBvcnQgZnMgZnJvbSBcImZzXCI7XG5pbXBvcnQgeyBjcmVhdGVEeW5hbWljU2hhcmVSZXNwb25zZSB9IGZyb20gXCIuL3NyYy9saWIvc2VydmVyU2hhcmVNZXRhZGF0YVwiO1xuXG4vLyBcdTI1MDBcdTI1MDAgU2l0ZW1hcCBtaWRkbGV3YXJlIHBsdWdpbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIFNlcnZlcyAvc2l0ZW1hcC54bWwgaW4gZGV2ICsgcHJldmlldyB3aXRoIGEgMS1ob3VyIGluLW1lbW9yeSBjYWNoZSBzb1xuLy8gR29vZ2xlYm90IG5ldmVyIHRyaWdnZXJzIGEgbGl2ZSBTdXBhYmFzZSBoaXQgb24gcmVwZWF0IGNyYXdscy5cbi8vIEluIHByb2R1Y3Rpb24gdGhlIHN0YXRpYyBwdWJsaWMvc2l0ZW1hcC54bWwgKHdyaXR0ZW4gYnkgcHJlYnVpbGQpIGlzIHNlcnZlZFxuLy8gYXMgYSBwbGFpbiBmaWxlIFx1MjAxNCB0aGlzIHBsdWdpbiBhZGRzIHRoZSBDYWNoZS1Db250cm9sIGhlYWRlciB0byB0aGF0IHRvby5cbmZ1bmN0aW9uIHNpdGVtYXBQbHVnaW4oKTogUGx1Z2luIHtcbiAgY29uc3QgU1VQQUJBU0VfVVJMID0gcHJvY2Vzcy5lbnYuVklURV9TVVBBQkFTRV9VUkwgfHwgXCJcIjtcbiAgY29uc3QgU1VQQUJBU0VfS0VZID0gcHJvY2Vzcy5lbnYuVklURV9TVVBBQkFTRV9BTk9OX0tFWSB8fCBcIlwiO1xuICBjb25zdCBCQVNFX1VSTCA9IFwiaHR0cHM6Ly9mbGlja3NpbmRpYS5vbmxpbmVcIjtcbiAgY29uc3QgUEFHRV9TSVpFID0gMTAwMDtcbiAgLy8gU2l0ZW1hcCBwcm90b2NvbCBsaW1pdCBpcyA1MCwwMDAgVVJMczsgdGhpcyBsaXZlIGZhbGxiYWNrIGVtaXRzIG9uZSBzdGF0aWNcbiAgLy8gaG9tZXBhZ2UgVVJMLCBsZWF2aW5nIHJvb20gZm9yIGF0IG1vc3QgNDksOTk5IHB1YmxpYyBwb3N0IFVSTHMuXG4gIGNvbnN0IE1BWF9EWU5BTUlDX1VSTFMgPSA0OV85OTk7XG4gIGNvbnN0IFRUTF9NUyA9IDYwICogNjAgKiAxMDAwOyAvLyAxIGhvdXJcblxuICAvLyBNb2R1bGUtbGV2ZWwgY2FjaGUgXHUyMDE0IHN1cnZpdmVzIHRoZSBlbnRpcmUgVml0ZSBkZXYtc2VydmVyIHNlc3Npb25cbiAgbGV0IGNhY2hlOiB7IHhtbDogc3RyaW5nOyBidWlsdEF0OiBudW1iZXIgfSB8IG51bGwgPSBudWxsO1xuXG4gIGFzeW5jIGZ1bmN0aW9uIGJ1aWxkU2l0ZW1hcFhtbCgpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIC8vIExhenktaW1wb3J0IHN1cGFiYXNlLWpzIHNvIHRoZSBwbHVnaW4gb25seSBwdWxscyBpdCBpbiB3aGVuIG5lZWRlZFxuICAgIGNvbnN0IHsgY3JlYXRlQ2xpZW50IH0gPSBhd2FpdCBpbXBvcnQoXCJAc3VwYWJhc2Uvc3VwYWJhc2UtanNcIik7XG4gICAgY29uc3Qgc2IgPSBjcmVhdGVDbGllbnQoU1VQQUJBU0VfVVJMLCBTVVBBQkFTRV9LRVksIHtcbiAgICAgIGF1dGg6IHsgcGVyc2lzdFNlc3Npb246IGZhbHNlIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCByb3dzOiB7IGlkOiBzdHJpbmc7IHVwZGF0ZWRfYXQ/OiBzdHJpbmc7IGNyZWF0ZWRfYXQ/OiBzdHJpbmcgfVtdID0gW107XG4gICAgbGV0IGZyb20gPSAwO1xuICAgIHdoaWxlIChyb3dzLmxlbmd0aCA8IE1BWF9EWU5BTUlDX1VSTFMpIHtcbiAgICAgIGNvbnN0IHBhZ2VTaXplID0gTWF0aC5taW4oUEFHRV9TSVpFLCBNQVhfRFlOQU1JQ19VUkxTIC0gcm93cy5sZW5ndGgpO1xuICAgICAgY29uc3QgeyBkYXRhLCBlcnJvciB9ID0gYXdhaXQgc2JcbiAgICAgICAgLmZyb20oXCJwb3N0c1wiKVxuICAgICAgICAuc2VsZWN0KFwiaWQsIHVwZGF0ZWRfYXQsIGNyZWF0ZWRfYXRcIilcbiAgICAgICAgLmVxKFwidmlzaWJpbGl0eVwiLCBcInB1YmxpY1wiKVxuICAgICAgICAub3JkZXIoXCJjcmVhdGVkX2F0XCIsIHsgYXNjZW5kaW5nOiBmYWxzZSB9KVxuICAgICAgICAucmFuZ2UoZnJvbSwgZnJvbSArIHBhZ2VTaXplIC0gMSk7XG4gICAgICBpZiAoZXJyb3IpIHRocm93IGVycm9yO1xuICAgICAgaWYgKCFkYXRhKSB0aHJvdyBuZXcgRXJyb3IoXCJTdXBhYmFzZSByZXR1cm5lZCBubyBzaXRlbWFwIHBhZ2UgZGF0YVwiKTtcbiAgICAgIGlmIChkYXRhLmxlbmd0aCA9PT0gMCkgYnJlYWs7XG4gICAgICByb3dzLnB1c2goLi4uZGF0YSk7XG4gICAgICBpZiAoZGF0YS5sZW5ndGggPCBwYWdlU2l6ZSkgYnJlYWs7XG4gICAgICBmcm9tICs9IGRhdGEubGVuZ3RoO1xuICAgIH1cblxuICAgIGNvbnN0IGVzYyA9IChzOiBzdHJpbmcpID0+XG4gICAgICBzLnJlcGxhY2UoLyYvZywgXCImYW1wO1wiKS5yZXBsYWNlKC88L2csIFwiJmx0O1wiKS5yZXBsYWNlKC8+L2csIFwiJmd0O1wiKTtcbiAgICBjb25zdCBkID0gKHJhdz86IHN0cmluZykgPT4ge1xuICAgICAgdHJ5IHsgcmV0dXJuIG5ldyBEYXRlKHJhdyEpLnRvSVNPU3RyaW5nKCkuc3BsaXQoXCJUXCIpWzBdOyB9XG4gICAgICBjYXRjaCB7IHJldHVybiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkuc3BsaXQoXCJUXCIpWzBdOyB9XG4gICAgfTtcblxuICAgIGNvbnN0IHVybEVudHJpZXMgPSByb3dzXG4gICAgICAubWFwKFxuICAgICAgICAocikgPT5cbiAgICAgICAgICBgICA8dXJsPlxcbmAgK1xuICAgICAgICAgIGAgICAgPGxvYz4ke2VzYyhgJHtCQVNFX1VSTH0vcG9zdC8ke3IuaWR9YCl9PC9sb2M+XFxuYCArXG4gICAgICAgICAgYCAgICA8bGFzdG1vZD4ke2Qoci51cGRhdGVkX2F0IHx8IHIuY3JlYXRlZF9hdCl9PC9sYXN0bW9kPlxcbmAgK1xuICAgICAgICAgIGAgICAgPGNoYW5nZWZyZXE+d2Vla2x5PC9jaGFuZ2VmcmVxPlxcbmAgK1xuICAgICAgICAgIGAgICAgPHByaW9yaXR5PjAuNzwvcHJpb3JpdHk+XFxuYCArXG4gICAgICAgICAgYCAgPC91cmw+YCxcbiAgICAgIClcbiAgICAgIC5qb2luKFwiXFxuXCIpO1xuXG4gICAgcmV0dXJuIChcbiAgICAgIGA8P3htbCB2ZXJzaW9uPVwiMS4wXCIgZW5jb2Rpbmc9XCJVVEYtOFwiPz5cXG5gICtcbiAgICAgIGA8dXJsc2V0IHhtbG5zPVwiaHR0cDovL3d3dy5zaXRlbWFwcy5vcmcvc2NoZW1hcy9zaXRlbWFwLzAuOVwiPlxcbmAgK1xuICAgICAgYCAgPHVybD5cXG4gICAgPGxvYz4ke2VzYyhCQVNFX1VSTCl9LzwvbG9jPlxcbiAgICA8Y2hhbmdlZnJlcT5kYWlseTwvY2hhbmdlZnJlcT5cXG4gICAgPHByaW9yaXR5PjEuMDwvcHJpb3JpdHk+XFxuICA8L3VybD5cXG5gICtcbiAgICAgICh1cmxFbnRyaWVzID8gdXJsRW50cmllcyArIFwiXFxuXCIgOiBcIlwiKSArXG4gICAgICBgPC91cmxzZXQ+XFxuYFxuICAgICk7XG4gIH1cblxuICAvLyBTaGFyZWQgaGFuZGxlciBcdTIwMTQgdXNlZCBieSBib3RoIGNvbmZpZ3VyZVNlcnZlciBhbmQgY29uZmlndXJlUHJldmlld1NlcnZlclxuICBmdW5jdGlvbiBhdHRhY2hTaXRlbWFwSGFuZGxlcihtaWRkbGV3YXJlczogYW55KSB7XG4gICAgbWlkZGxld2FyZXMudXNlKFxuICAgICAgXCIvc2l0ZW1hcC54bWxcIixcbiAgICAgIGFzeW5jIChyZXE6IGFueSwgcmVzOiBhbnksIG5leHQ6IGFueSkgPT4ge1xuICAgICAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuXG4gICAgICAgIC8vIDEuIFJldHVybiBpbi1tZW1vcnkgY2FjaGUgaWYgc3RpbGwgZnJlc2hcbiAgICAgICAgaWYgKGNhY2hlICYmIG5vdyAtIGNhY2hlLmJ1aWx0QXQgPCBUVExfTVMpIHtcbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24veG1sOyBjaGFyc2V0PXV0Zi04XCIpO1xuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDYWNoZS1Db250cm9sXCIsIFwicHVibGljLCBtYXgtYWdlPTM2MDBcIik7XG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIlgtU2l0ZW1hcC1DYWNoZVwiLCBcIkhJVFwiKTtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDIwMDtcbiAgICAgICAgICByZXMuZW5kKGNhY2hlLnhtbCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gMi4gVHJ5IHRvIHNlcnZlIHRoZSBwcmUtYnVpbHQgc3RhdGljIGZpbGUgKHdyaXR0ZW4gYnkgYHByZWJ1aWxkYClcbiAgICAgICAgY29uc3Qgc3RhdGljUGF0aCA9IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwicHVibGljXCIsIFwic2l0ZW1hcC54bWxcIik7XG4gICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHN0YXRpY1BhdGgpKSB7XG4gICAgICAgICAgY29uc3QgeG1sID0gZnMucmVhZEZpbGVTeW5jKHN0YXRpY1BhdGgsIFwidXRmOFwiKTtcbiAgICAgICAgICBjYWNoZSA9IHsgeG1sLCBidWlsdEF0OiBub3cgfTtcbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24veG1sOyBjaGFyc2V0PXV0Zi04XCIpO1xuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDYWNoZS1Db250cm9sXCIsIFwicHVibGljLCBtYXgtYWdlPTM2MDBcIik7XG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIlgtU2l0ZW1hcC1DYWNoZVwiLCBcIkZJTEVcIik7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSAyMDA7XG4gICAgICAgICAgcmVzLmVuZCh4bWwpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIDMuIEZhbGxiYWNrIFx1MjAxNCBnZW5lcmF0ZSBsaXZlIGZyb20gU3VwYWJhc2UgKGZpcnN0LWV2ZXIgZGV2IGNvbGQgc3RhcnQpXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgeG1sID0gYXdhaXQgYnVpbGRTaXRlbWFwWG1sKCk7XG4gICAgICAgICAgY2FjaGUgPSB7IHhtbCwgYnVpbHRBdDogbm93IH07XG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL3htbDsgY2hhcnNldD11dGYtOFwiKTtcbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ2FjaGUtQ29udHJvbFwiLCBcInB1YmxpYywgbWF4LWFnZT0zNjAwXCIpO1xuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJYLVNpdGVtYXAtQ2FjaGVcIiwgXCJMSVZFXCIpO1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gMjAwO1xuICAgICAgICAgIHJlcy5lbmQoeG1sKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihcIltzaXRlbWFwXSBnZW5lcmF0aW9uIGZhaWxlZDpcIiwgZXJyKTtcbiAgICAgICAgICBuZXh0KCk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgbmFtZTogXCJmbGlja3Mtc2l0ZW1hcFwiLFxuICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHsgYXR0YWNoU2l0ZW1hcEhhbmRsZXIoc2VydmVyLm1pZGRsZXdhcmVzKTsgfSxcbiAgICBjb25maWd1cmVQcmV2aWV3U2VydmVyKHNlcnZlcikgeyBhdHRhY2hTaXRlbWFwSGFuZGxlcihzZXJ2ZXIubWlkZGxld2FyZXMpOyB9LFxuICB9O1xufVxuXG4vLyBWaXRlJ3MgZGV2IGFuZCBwcmV2aWV3IHNlcnZlcnMgYXJlIGFsc28gdGhlIFJlcGxpdCBkZXBsb3ltZW50IHJ1bnRpbWUuXG4vLyBTZXJ2ZSByYXcgcGVyLWl0ZW0gbWV0YWRhdGEgdG8gc29jaWFsIGNyYXdsZXJzIGJlZm9yZSB0aGUgU1BBIGZhbGxiYWNrIHJ1bnMuXG5mdW5jdGlvbiBzb2NpYWxTaGFyZU1ldGFkYXRhUGx1Z2luKCk6IFBsdWdpbiB7XG4gIGZ1bmN0aW9uIGF0dGFjaFNoYXJlTWV0YWRhdGFIYW5kbGVyKG1pZGRsZXdhcmVzOiBhbnkpIHtcbiAgICBtaWRkbGV3YXJlcy51c2UoYXN5bmMgKHJlcTogYW55LCByZXM6IGFueSwgbmV4dDogYW55KSA9PiB7XG4gICAgICBpZiAocmVxLm1ldGhvZCAhPT0gXCJHRVRcIiAmJiByZXEubWV0aG9kICE9PSBcIkhFQURcIikge1xuICAgICAgICBuZXh0KCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVxdWVzdFVybCA9IG5ldyBVUkwocmVxLnVybCB8fCBcIi9cIiwgXCJodHRwOi8vbG9jYWxob3N0XCIpLnRvU3RyaW5nKCk7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgY3JlYXRlRHluYW1pY1NoYXJlUmVzcG9uc2UoXG4gICAgICAgICAgcmVxdWVzdFVybCxcbiAgICAgICAgICBTdHJpbmcocmVxLmhlYWRlcnM/LltcInVzZXItYWdlbnRcIl0gfHwgXCJcIiksXG4gICAgICAgICAgcHJvY2Vzcy5lbnYsXG4gICAgICAgICk7XG4gICAgICAgIGlmICghcmVzcG9uc2UpIHtcbiAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSByZXNwb25zZS5zdGF0dXM7XG4gICAgICAgIHJlc3BvbnNlLmhlYWRlcnMuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4gcmVzLnNldEhlYWRlcihrZXksIHZhbHVlKSk7XG4gICAgICAgIHJlcy5lbmQocmVxLm1ldGhvZCA9PT0gXCJIRUFEXCIgPyB1bmRlZmluZWQgOiBhd2FpdCByZXNwb25zZS50ZXh0KCkpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihcIltzaGFyZS1tZXRhZGF0YV0gcmVxdWVzdCBmYWlsZWQ6XCIsIGVycm9yKTtcbiAgICAgICAgbmV4dCgpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBcImZsaWNrcy1zb2NpYWwtc2hhcmUtbWV0YWRhdGFcIixcbiAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICBhdHRhY2hTaGFyZU1ldGFkYXRhSGFuZGxlcihzZXJ2ZXIubWlkZGxld2FyZXMpO1xuICAgIH0sXG4gICAgY29uZmlndXJlUHJldmlld1NlcnZlcihzZXJ2ZXIpIHtcbiAgICAgIGF0dGFjaFNoYXJlTWV0YWRhdGFIYW5kbGVyKHNlcnZlci5taWRkbGV3YXJlcyk7XG4gICAgfSxcbiAgfTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwIEFQSyBkb3dubG9hZCBtaWRkbGV3YXJlIHBsdWdpbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIFNlcnZlcyAvZG93bmxvYWQvYXBrIFx1MjE5MiBhcHAtcmVsZWFzZS1zaWduZWQuYXBrIChvciBwdWJsaWMvYXBwLmFwayBmYWxsYmFjaylcbi8vIHdpdGggY29ycmVjdCBDb250ZW50LVR5cGUgYW5kIENvbnRlbnQtRGlzcG9zaXRpb24gc28gYnJvd3NlcnMgdHJpZ2dlciBhIHNhdmUuXG4vLyBUaGUgYmluYXJ5IGlzIGdpdGlnbm9yZWQgc28gdGhpcyBvbmx5IHJ1bnMgaW4gdGhlIFJlcGxpdCBkZXYgZW52aXJvbm1lbnQuXG5mdW5jdGlvbiBhcGtEb3dubG9hZFBsdWdpbigpOiBQbHVnaW4ge1xuICBjb25zdCBjYW5kaWRhdGVzID0gW1xuICAgIHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiYXBwLXJlbGVhc2Utc2lnbmVkLmFwa1wiKSxcbiAgICBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcInB1YmxpY1wiLCBcImFwcC5hcGtcIiksXG4gIF07XG5cbiAgZnVuY3Rpb24gYXR0YWNoQXBrSGFuZGxlcihtaWRkbGV3YXJlczogYW55KSB7XG4gICAgbWlkZGxld2FyZXMudXNlKFwiL2Rvd25sb2FkL2Fwa1wiLCAocmVxOiBhbnksIHJlczogYW55LCBuZXh0OiBhbnkpID0+IHtcbiAgICAgIGNvbnN0IGFwa1BhdGggPSBjYW5kaWRhdGVzLmZpbmQoZnMuZXhpc3RzU3luYyk7XG4gICAgICBpZiAoIWFwa1BhdGgpIHtcbiAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA0MDQ7XG4gICAgICAgIHJlcy5lbmQoXCJBUEsgbm90IGZvdW5kIG9uIGRpc2suXCIpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb25zdCBzdGF0ID0gZnMuc3RhdFN5bmMoYXBrUGF0aCk7XG4gICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vdm5kLmFuZHJvaWQucGFja2FnZS1hcmNoaXZlXCIpO1xuICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtRGlzcG9zaXRpb25cIiwgJ2F0dGFjaG1lbnQ7IGZpbGVuYW1lPVwiRmxpY2tzSW5kaWEuYXBrXCInKTtcbiAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LUxlbmd0aFwiLCBzdGF0LnNpemUpO1xuICAgICAgcmVzLnNldEhlYWRlcihcIkNhY2hlLUNvbnRyb2xcIiwgXCJuby1zdG9yZVwiKTtcbiAgICAgIHJlcy5zdGF0dXNDb2RlID0gMjAwO1xuICAgICAgZnMuY3JlYXRlUmVhZFN0cmVhbShhcGtQYXRoKS5waXBlKHJlcyk7XG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIG5hbWU6IFwiZmxpY2tzLWFway1kb3dubG9hZFwiLFxuICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHsgYXR0YWNoQXBrSGFuZGxlcihzZXJ2ZXIubWlkZGxld2FyZXMpOyB9LFxuICAgIGNvbmZpZ3VyZVByZXZpZXdTZXJ2ZXIoc2VydmVyKSB7IGF0dGFjaEFwa0hhbmRsZXIoc2VydmVyLm1pZGRsZXdhcmVzKTsgfSxcbiAgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgYmFzZTogXCIvXCIsXG5cbiAgc2VydmVyOiB7XG4gICAgaG9zdDogXCIwLjAuMC4wXCIsXG4gICAgcG9ydDogNTAwMCxcbiAgICBhbGxvd2VkSG9zdHM6IHRydWUsXG4gICAgaG1yOiB7IG92ZXJsYXk6IGZhbHNlIH0sXG4gICAgaGVhZGVyczoge1xuICAgICAgXCJDYWNoZS1Db250cm9sXCI6IFwibm8tc3RvcmUsIG5vLWNhY2hlLCBtdXN0LXJldmFsaWRhdGUsIHByb3h5LXJldmFsaWRhdGVcIixcbiAgICAgIFwiUHJhZ21hXCI6IFwibm8tY2FjaGVcIixcbiAgICAgIFwiRXhwaXJlc1wiOiBcIjBcIixcbiAgICB9LFxuICB9LFxuXG4gIHByZXZpZXc6IHtcbiAgICBob3N0OiBcIjAuMC4wLjBcIixcbiAgICBwb3J0OiA1MDAwLFxuICAgIGFsbG93ZWRIb3N0czogdHJ1ZSxcbiAgfSxcblxuICBwbHVnaW5zOiBbcmVhY3QoKSwgc29jaWFsU2hhcmVNZXRhZGF0YVBsdWdpbigpLCBzaXRlbWFwUGx1Z2luKCksIGFwa0Rvd25sb2FkUGx1Z2luKCldLFxuXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczogeyBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSB9LFxuICAgIGRlZHVwZTogW1xuICAgICAgXCJyZWFjdFwiLFxuICAgICAgXCJyZWFjdC1kb21cIixcbiAgICAgIFwicmVhY3QvanN4LXJ1bnRpbWVcIixcbiAgICAgIFwicmVhY3QvanN4LWRldi1ydW50aW1lXCIsXG4gICAgXSxcbiAgfSxcblxuICBidWlsZDoge1xuICAgIG91dERpcjogXCJkaXN0XCIsXG4gICAgZW1wdHlPdXREaXI6IHRydWUsXG4gICAgc291cmNlbWFwOiBmYWxzZSxcbiAgICBtaW5pZnk6IFwiZXNidWlsZFwiLFxuICAgIGNzc01pbmlmeTogXCJlc2J1aWxkXCIsXG4gICAgcmVwb3J0Q29tcHJlc3NlZFNpemU6IGZhbHNlLFxuICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogNjAwLFxuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIGV4dGVybmFsOiBbXCJvbm54cnVudGltZS13ZWJcIiwgXCJvbm54cnVudGltZS13ZWIvd2ViZ3B1XCIsIFwiQGltZ2x5L2JhY2tncm91bmQtcmVtb3ZhbFwiLCBcIkBnb29nbGUvZ2VuZXJhdGl2ZS1haVwiXSxcbiAgICAgIG9ud2Fybih3YXJuaW5nLCB3YXJuKSB7XG4gICAgICAgIGlmICh3YXJuaW5nLmNvZGUgPT09IFwiQ0lSQ1VMQVJfREVQRU5ERU5DWVwiKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihcIlx1RDgzRFx1REQzNCBDSVJDVUxBUjpcIiwgd2FybmluZy5tZXNzYWdlKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgd2Fybih3YXJuaW5nKTtcbiAgICAgIH0sXG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgbWFudWFsQ2h1bmtzOiAoaWQ6IHN0cmluZykgPT4ge1xuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL3JlYWN0L1wiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvcmVhY3QtZG9tL1wiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvc2NoZWR1bGVyL1wiKVxuICAgICAgICAgIClcbiAgICAgICAgICAgIHJldHVybiBcInZlbmRvci1yZWFjdFwiO1xuXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL2ZyYW1lci1tb3Rpb25cIikpIHJldHVybiBcInZlbmRvci1mcmFtZXJcIjtcblxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9sdWNpZGUtcmVhY3RcIikpIHJldHVybiBcInZlbmRvci1sdWNpZGVcIjtcblxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9Ac3VwYWJhc2VcIikpIHJldHVybiBcInZlbmRvci1zdXBhYmFzZVwiO1xuXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL0B0YW5zdGFja1wiKSkgcmV0dXJuIFwidmVuZG9yLXF1ZXJ5XCI7XG5cbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9AcmFkaXgtdWlcIikgfHxcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL2NtZGtcIilcbiAgICAgICAgICApXG4gICAgICAgICAgICByZXR1cm4gXCJ2ZW5kb3ItdWlcIjtcblxuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL3JlYWN0LXJvdXRlclwiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvd291dGVyXCIpXG4gICAgICAgICAgKVxuICAgICAgICAgICAgcmV0dXJuIFwidmVuZG9yLXJvdXRlclwiO1xuXG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvQGltZ2x5XCIpIHx8XG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9vbm54cnVudGltZVwiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvb25ueFwiKVxuICAgICAgICAgIClcbiAgICAgICAgICAgIHJldHVybiBcInZlbmRvci1vbm54XCI7XG5cbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9hZ29yYVwiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvYWdvcmEtcnRjXCIpXG4gICAgICAgICAgKVxuICAgICAgICAgICAgcmV0dXJuIFwidmVuZG9yLWFnb3JhXCI7XG5cbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvcmVhY3QtaWNvbnNcIikpIHJldHVybiBcInZlbmRvci1pY29uc1wiO1xuXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL1wiKSkgcmV0dXJuIFwidmVuZG9yLW1pc2NcIjtcblxuICAgICAgICAgIC8vIFx1MjUwMFx1MjUwMCBMb2NhbCBzaGFyZWQgbW9kdWxlcyBcdTIwMTQgZ2l2ZSBlYWNoIGl0cyBvd24gc3RhYmxlIGNodW5rIHNvXG4gICAgICAgICAgLy8gICAgUm9sbHVwIGFsd2F5cyBpbml0aWFsaXNlcyB0aGVtIGJlZm9yZSBhbnkgZmVhdHVyZSBjaHVuayBcdTI1MDBcdTI1MDBcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCIvc3JjL2xpYi9zdXBhYmFzZUNsaWVudFwiKSkgcmV0dXJuIFwiYXBwLXN1cGFiYXNlXCI7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwiL3NyYy9saWIvYWRtaW5Db25maWdcIikpICAgIHJldHVybiBcImFwcC1hZG1pblwiO1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIi9zcmMvbGliL21lbnRpb25zXCIpKSAgICAgICByZXR1cm4gXCJhcHAtbWVudGlvbnNcIjtcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCIvc3JjL2xpYi9zaGFyZVBvc3RcIikpICAgICAgcmV0dXJuIFwiYXBwLXNoYXJlXCI7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwiL3NyYy9jb250ZXh0L1wiKSkgICAgICAgICAgIHJldHVybiBcImFwcC1jb250ZXh0XCI7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwiL3NyYy9ob29rcy9cIikpICAgICAgICAgICAgIHJldHVybiBcImFwcC1ob29rc1wiO1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIi9zcmMvY29tcG9uZW50cy9FcnJvckJvdW5kYXJ5XCIpKSByZXR1cm4gXCJhcHAtZXJyb3ItYm91bmRhcnlcIjtcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCIvc3JjL2NvbXBvbmVudHMvQXV0b1BsYXlNdXRlZFZpZGVvXCIpKSByZXR1cm4gXCJhcHAtYXV0b3BsYXlcIjtcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCIvc3JjL2NvbXBvbmVudHMvUmljaENhcHRpb25cIikpICByZXR1cm4gXCJhcHAtcmljaC1jYXB0aW9uXCI7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG59KTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL2hvbWUvcnVubmVyL3dvcmtzcGFjZS9zcmMvbGliXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9ydW5uZXIvd29ya3NwYWNlL3NyYy9saWIvc2VydmVyU2hhcmVNZXRhZGF0YS50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vaG9tZS9ydW5uZXIvd29ya3NwYWNlL3NyYy9saWIvc2VydmVyU2hhcmVNZXRhZGF0YS50c1wiO2NvbnN0IFNJVEVfVVJMID0gXCJodHRwczovL2ZsaWNrc2luZGlhLm9ubGluZVwiO1xuY29uc3QgREVGQVVMVF9JTUFHRSA9IFwiaHR0cHM6Ly9pLmliYi5jby9IVDdSdkZ4cy9mbGlja3NpbmRpYS5wbmdcIjtcbmNvbnN0IEJPVF9QQVRURVJOID1cbiAgL1doYXRzQXBwfGZhY2Vib29rZXh0ZXJuYWxoaXR8RmFjZWJvdHxUd2l0dGVyYm90fExpbmtlZEluQm90fFNsYWNrYm90fERpc2NvcmRib3R8VGVsZWdyYW1Cb3R8UGludGVyZXN0fEdvb2dsZWJvdHxJbnN0YWdyYW18bWV0YS1leHRlcm5hbGFnZW50fG1ldGEtZXh0ZXJuYWxmZXRjaGVyL2k7XG5cbnR5cGUgU2hhcmVNZXRhZGF0YUVudmlyb25tZW50ID0ge1xuICBWSVRFX1NVUEFCQVNFX1VSTD86IHN0cmluZztcbiAgU1VQQUJBU0VfVVJMPzogc3RyaW5nO1xuICBWSVRFX1NVUEFCQVNFX0FOT05fS0VZPzogc3RyaW5nO1xuICBTVVBBQkFTRV9BTk9OX0tFWT86IHN0cmluZztcbn07XG5cbmZ1bmN0aW9uIGVzY2FwZUh0bWwodmFsdWU6IHVua25vd24pOiBzdHJpbmcge1xuICByZXR1cm4gU3RyaW5nKHZhbHVlID8/IFwiXCIpXG4gICAgLnJlcGxhY2UoLyYvZywgXCImYW1wO1wiKVxuICAgIC5yZXBsYWNlKC9cIi9nLCBcIiZxdW90O1wiKVxuICAgIC5yZXBsYWNlKC88L2csIFwiJmx0O1wiKVxuICAgIC5yZXBsYWNlKC8+L2csIFwiJmd0O1wiKTtcbn1cblxuZnVuY3Rpb24gYWJzb2x1dGVIdHRwVXJsKHZhbHVlPzogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgaWYgKCF2YWx1ZSkgcmV0dXJuIHVuZGVmaW5lZDtcbiAgdHJ5IHtcbiAgICBjb25zdCBwYXJzZWQgPSBuZXcgVVJMKHZhbHVlKTtcbiAgICByZXR1cm4gcGFyc2VkLnByb3RvY29sID09PSBcImh0dHA6XCIgfHwgcGFyc2VkLnByb3RvY29sID09PSBcImh0dHBzOlwiXG4gICAgICA/IHBhcnNlZC50b1N0cmluZygpXG4gICAgICA6IHVuZGVmaW5lZDtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc1N0YXRpY0FwcEltYWdlKHZhbHVlOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBpbWFnZSA9IG5ldyBVUkwodmFsdWUpO1xuICAgIGNvbnN0IGZhbGxiYWNrID0gbmV3IFVSTChERUZBVUxUX0lNQUdFKTtcbiAgICByZXR1cm4gKFxuICAgICAgKGltYWdlLmhvc3RuYW1lID09PSBmYWxsYmFjay5ob3N0bmFtZSAmJiBpbWFnZS5wYXRobmFtZSA9PT0gZmFsbGJhY2sucGF0aG5hbWUpIHx8XG4gICAgICAoaW1hZ2UuaG9zdG5hbWUudG9Mb3dlckNhc2UoKSA9PT0gXCJmbGlja3NpbmRpYS5vbmxpbmVcIiAmJlxuICAgICAgICBbXCIvbG9nby5wbmdcIiwgXCIvYXBwLWljb24ucG5nXCJdLmluY2x1ZGVzKGltYWdlLnBhdGhuYW1lLnRvTG93ZXJDYXNlKCkpKVxuICAgICk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG5mdW5jdGlvbiBmaXJzdE1lZGlhVXJsKC4uLnZhbHVlczogdW5rbm93bltdKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgZm9yIChjb25zdCB2YWx1ZSBvZiB2YWx1ZXMpIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSBcInN0cmluZ1wiKSB7XG4gICAgICBjb25zdCBjYW5kaWRhdGUgPSB2YWx1ZS50cmltKCk7XG4gICAgICBpZiAoIWNhbmRpZGF0ZSkgY29udGludWU7XG4gICAgICBpZiAoY2FuZGlkYXRlLnN0YXJ0c1dpdGgoXCJbXCIpIHx8IGNhbmRpZGF0ZS5zdGFydHNXaXRoKFwie1wiKSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IG5lc3RlZCA9IGZpcnN0TWVkaWFVcmwoSlNPTi5wYXJzZShjYW5kaWRhdGUpKTtcbiAgICAgICAgICBpZiAobmVzdGVkKSByZXR1cm4gbmVzdGVkO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAvLyBBIG1hbGZvcm1lZCBKU09OLWxpa2UgdmFsdWUgbWF5IHN0aWxsIGJlIGEgbGl0ZXJhbCBVUkwuXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGNvbnN0IGZpcnN0VXJsID0gY2FuZGlkYXRlLnNwbGl0KC8sKD89aHR0cHM/OlxcL1xcLykvLCAxKVswXT8udHJpbSgpO1xuICAgICAgaWYgKGZpcnN0VXJsICYmICFpc1N0YXRpY0FwcEltYWdlKGZpcnN0VXJsKSkgcmV0dXJuIGZpcnN0VXJsO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICBjb25zdCBuZXN0ZWQgPSBmaXJzdE1lZGlhVXJsKC4uLnZhbHVlKTtcbiAgICAgIGlmIChuZXN0ZWQpIHJldHVybiBuZXN0ZWQ7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiKSB7XG4gICAgICBjb25zdCBpdGVtID0gdmFsdWUgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gICAgICBjb25zdCBuZXN0ZWQgPSBmaXJzdE1lZGlhVXJsKFxuICAgICAgICBpdGVtLnVybCxcbiAgICAgICAgaXRlbS5zZWN1cmVfdXJsLFxuICAgICAgICBpdGVtLnB1YmxpY1VybCxcbiAgICAgICAgaXRlbS5pbWFnZV91cmwsXG4gICAgICAgIGl0ZW0ubWVkaWFfdXJsLFxuICAgICAgICBpdGVtLnZpZGVvX3VybCxcbiAgICAgICk7XG4gICAgICBpZiAobmVzdGVkKSByZXR1cm4gbmVzdGVkO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBtZXRhZGF0YU9mKHBvc3Q6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBSZWNvcmQ8c3RyaW5nLCBhbnk+IHtcbiAgaWYgKHBvc3QubWV0YWRhdGEgJiYgdHlwZW9mIHBvc3QubWV0YWRhdGEgPT09IFwib2JqZWN0XCIpIHJldHVybiBwb3N0Lm1ldGFkYXRhO1xuICBpZiAodHlwZW9mIHBvc3QubWV0YWRhdGEgPT09IFwic3RyaW5nXCIpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShwb3N0Lm1ldGFkYXRhKTtcbiAgICAgIHJldHVybiBwYXJzZWQgJiYgdHlwZW9mIHBhcnNlZCA9PT0gXCJvYmplY3RcIiA/IHBhcnNlZCA6IHt9O1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIHt9O1xuICAgIH1cbiAgfVxuICByZXR1cm4ge307XG59XG5cbmZ1bmN0aW9uIGNsb3VkaW5hcnlWaWRlb1Bvc3Rlcih2YWx1ZT86IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIGlmICghdmFsdWUpIHJldHVybiB1bmRlZmluZWQ7XG4gIHRyeSB7XG4gICAgY29uc3QgdmlkZW9VcmwgPSBuZXcgVVJMKHZhbHVlKTtcbiAgICBpZiAoIXZpZGVvVXJsLmhvc3RuYW1lLmVuZHNXaXRoKFwiY2xvdWRpbmFyeS5jb21cIikpIHJldHVybiB1bmRlZmluZWQ7XG5cbiAgICBjb25zdCBtYXJrZXIgPSBcIi92aWRlby91cGxvYWQvXCI7XG4gICAgY29uc3QgdXBsb2FkSW5kZXggPSB2aWRlb1VybC5wYXRobmFtZS5pbmRleE9mKG1hcmtlcik7XG4gICAgaWYgKHVwbG9hZEluZGV4IDwgMCkgcmV0dXJuIHVuZGVmaW5lZDtcblxuICAgIGNvbnN0IGJlZm9yZVVwbG9hZCA9IHZpZGVvVXJsLnBhdGhuYW1lLnNsaWNlKDAsIHVwbG9hZEluZGV4ICsgbWFya2VyLmxlbmd0aCk7XG4gICAgY29uc3QgdXBsb2FkUGF0aCA9IHZpZGVvVXJsLnBhdGhuYW1lLnNsaWNlKHVwbG9hZEluZGV4ICsgbWFya2VyLmxlbmd0aCk7XG4gICAgY29uc3Qgd2l0aFBvc3RlckZyYW1lID0gdXBsb2FkUGF0aC5zdGFydHNXaXRoKFwic29fMC9cIilcbiAgICAgID8gdXBsb2FkUGF0aFxuICAgICAgOiBgc29fMC8ke3VwbG9hZFBhdGh9YDtcbiAgICBjb25zdCBpbWFnZVBhdGggPSB3aXRoUG9zdGVyRnJhbWUucmVwbGFjZShcbiAgICAgIC9cXC4oPzptcDR8bTR2fG1vdnx3ZWJtfG9nZ3xtM3U4KSQvaSxcbiAgICAgIFwiLmpwZ1wiLFxuICAgICk7XG4gICAgdmlkZW9VcmwucGF0aG5hbWUgPSBgJHtiZWZvcmVVcGxvYWR9JHtpbWFnZVBhdGh9YDtcbiAgICB2aWRlb1VybC5zZWFyY2ggPSBcIlwiO1xuICAgIHJldHVybiB2aWRlb1VybC50b1N0cmluZygpO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVTb2NpYWxJbWFnZShwb3N0OiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgY29uc3QgbWV0YWRhdGEgPSBtZXRhZGF0YU9mKHBvc3QpO1xuICBjb25zdCB2aWRlb1NvdXJjZSA9IGZpcnN0TWVkaWFVcmwoXG4gICAgcG9zdC52aWRlb191cmwsXG4gICAgbWV0YWRhdGEudmlkZW9fdXJsLFxuICAgIG1ldGFkYXRhLnZpZGVvVXJsLFxuICAgIHBvc3QubWVkaWFfdXJsLFxuICAgIG1ldGFkYXRhLm1lZGlhX3VybCxcbiAgICBtZXRhZGF0YS5tZWRpYVVybCxcbiAgKTtcbiAgY29uc3QgaXNWaWRlbyA9XG4gICAgW1wicmVlbFwiLCBcInZpZGVvXCJdLmluY2x1ZGVzKFN0cmluZyhwb3N0LnR5cGUgfHwgXCJcIikudG9Mb3dlckNhc2UoKSkgfHxcbiAgICBtZXRhZGF0YS5pc192aWRlbyA9PT0gdHJ1ZSB8fFxuICAgIG1ldGFkYXRhLmlzVmlkZW8gPT09IHRydWUgfHxcbiAgICAhIXZpZGVvU291cmNlICYmIC9cXC92aWRlb1xcL3VwbG9hZFxcL3xcXC4oPzptcDR8bTR2fG1vdnx3ZWJtfG9nZ3xtM3U4KSg/Ols/I118JCkvaS50ZXN0KHZpZGVvU291cmNlKTtcbiAgY29uc3QgcHJldmlld0NhbmRpZGF0ZXMgPSBbXG4gICAgcG9zdC5wcmV2aWV3X3VybCxcbiAgICBwb3N0LnZpZGVvX3RodW1ibmFpbF91cmwsXG4gICAgcG9zdC50aHVtYm5haWxfdXJsLFxuICAgIHBvc3QudGh1bWJfdXJsLFxuICAgIHBvc3QucG9zdGVyX3VybCxcbiAgICBwb3N0LmNvdmVyX3VybCxcbiAgICBtZXRhZGF0YS5wcmV2aWV3X3VybCxcbiAgICBtZXRhZGF0YS5wcmV2aWV3VXJsLFxuICAgIG1ldGFkYXRhLnZpZGVvX3RodW1ibmFpbF91cmwsXG4gICAgbWV0YWRhdGEudmlkZW9UaHVtYm5haWxVcmwsXG4gICAgbWV0YWRhdGEudGh1bWJuYWlsX3VybCxcbiAgICBtZXRhZGF0YS50aHVtYm5haWxVcmwsXG4gICAgbWV0YWRhdGEudGh1bWJfdXJsLFxuICAgIG1ldGFkYXRhLnRodW1iVXJsLFxuICAgIG1ldGFkYXRhLnBvc3Rlcl91cmwsXG4gICAgbWV0YWRhdGEucG9zdGVyVXJsLFxuICAgIG1ldGFkYXRhLmNvdmVyX3VybCxcbiAgICBtZXRhZGF0YS5jb3ZlclVybCxcbiAgXTtcbiAgY29uc3QgaW1hZ2VDYW5kaWRhdGVzID0gW1xuICAgIHBvc3QuaW1hZ2VfdXJsLFxuICAgIHBvc3QuaW1hZ2VfdXJscyxcbiAgICBtZXRhZGF0YS5pbWFnZV91cmwsXG4gICAgbWV0YWRhdGEuaW1hZ2VVcmwsXG4gICAgbWV0YWRhdGEuaW1hZ2VfdXJscyxcbiAgICBtZXRhZGF0YS5pbWFnZVVybHMsXG4gIF07XG4gIGNvbnN0IHZpZGVvQ2FuZGlkYXRlcyA9IFtcbiAgICBwb3N0LnZpZGVvX3VybCxcbiAgICBtZXRhZGF0YS52aWRlb191cmwsXG4gICAgbWV0YWRhdGEudmlkZW9VcmwsXG4gIF07XG4gIGNvbnN0IG1lZGlhQ2FuZGlkYXRlcyA9IFtcbiAgICBwb3N0Lm1lZGlhX3VybCxcbiAgICBtZXRhZGF0YS5tZWRpYV91cmwsXG4gICAgbWV0YWRhdGEubWVkaWFVcmwsXG4gIF07XG4gIGNvbnN0IHByZXZpZXdVcmwgPSBhYnNvbHV0ZUh0dHBVcmwoXG4gICAgZmlyc3RNZWRpYVVybChcbiAgICAgIC4uLihpc1ZpZGVvXG4gICAgICAgID8gWy4uLnByZXZpZXdDYW5kaWRhdGVzLCAuLi5pbWFnZUNhbmRpZGF0ZXMsIC4uLnZpZGVvQ2FuZGlkYXRlcywgLi4ubWVkaWFDYW5kaWRhdGVzXVxuICAgICAgICA6IFsuLi5pbWFnZUNhbmRpZGF0ZXMsIC4uLm1lZGlhQ2FuZGlkYXRlcywgLi4ucHJldmlld0NhbmRpZGF0ZXMsIC4uLnZpZGVvQ2FuZGlkYXRlc10pLFxuICAgICksXG4gICk7XG4gIGlmICghcHJldmlld1VybCkgcmV0dXJuIHVuZGVmaW5lZDtcblxuICBpZiAoL1xcL3ZpZGVvXFwvdXBsb2FkXFwvfFxcLig/Om1wNHxtNHZ8bW92fHdlYm18b2dnfG0zdTgpKD86Wz8jXXwkKS9pLnRlc3QocHJldmlld1VybCkpIHtcbiAgICByZXR1cm4gY2xvdWRpbmFyeVZpZGVvUG9zdGVyKHByZXZpZXdVcmwpIHx8IHByZXZpZXdVcmw7XG4gIH1cbiAgcmV0dXJuIHByZXZpZXdVcmw7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGZldGNoUHVibGljUm93KFxuICBzdXBhYmFzZVVybDogc3RyaW5nLFxuICBhbm9uS2V5OiBzdHJpbmcsXG4gIHRhYmxlOiBcInBvc3RzXCIgfCBcImZyYW1lX3JlcXVlc3RzXCIsXG4gIGZpbHRlcnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4sXG4gIGZpZWxkczogc3RyaW5nLFxuKTogUHJvbWlzZTxSZWNvcmQ8c3RyaW5nLCBhbnk+IHwgbnVsbD4ge1xuICBjb25zdCBlbmRwb2ludCA9IG5ldyBVUkwoYC9yZXN0L3YxLyR7dGFibGV9YCwgc3VwYWJhc2VVcmwpO1xuICBlbmRwb2ludC5zZWFyY2hQYXJhbXMuc2V0KFwic2VsZWN0XCIsIGZpZWxkcyk7XG4gIGVuZHBvaW50LnNlYXJjaFBhcmFtcy5zZXQoXCJsaW1pdFwiLCBcIjFcIik7XG4gIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGZpbHRlcnMpKSB7XG4gICAgZW5kcG9pbnQuc2VhcmNoUGFyYW1zLnNldChrZXksIHZhbHVlKTtcbiAgfVxuXG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goZW5kcG9pbnQsIHtcbiAgICBoZWFkZXJzOiB7XG4gICAgICBhcGlrZXk6IGFub25LZXksXG4gICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7YW5vbktleX1gLFxuICAgICAgQWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICB9LFxuICAgIHNpZ25hbDogQWJvcnRTaWduYWwudGltZW91dCg1MDAwKSxcbiAgfSk7XG4gIGlmICghcmVzcG9uc2Uub2spIHJldHVybiBudWxsO1xuXG4gIGNvbnN0IHJvd3MgPSAoYXdhaXQgcmVzcG9uc2UuanNvbigpKSBhcyBSZWNvcmQ8c3RyaW5nLCBhbnk+W107XG4gIHJldHVybiByb3dzPy5bMF0gPz8gbnVsbDtcbn1cblxuLyoqXG4gKiBSZXR1cm4gY3Jhd2xlci1yZWFkeSBIVE1MIGZvciBhIHBvc3Qgb3IgRmxpY2tzIEZyYW1lIHJlcXVlc3QuXG4gKiBSZXR1cm4gbnVsbCBmb3Igb3JkaW5hcnkgdmlzaXRvcnMgb3IgdW5rbm93biBVUkxzIHNvIHRoZSBTUEEgY2FuIHNlcnZlIHRoZW0uXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjcmVhdGVEeW5hbWljU2hhcmVSZXNwb25zZShcbiAgcmVxdWVzdFVybDogc3RyaW5nLFxuICB1c2VyQWdlbnQ6IHN0cmluZyxcbiAgZW52aXJvbm1lbnQ6IFNoYXJlTWV0YWRhdGFFbnZpcm9ubWVudCA9IHt9LFxuKTogUHJvbWlzZTxSZXNwb25zZSB8IG51bGw+IHtcbiAgaWYgKCFCT1RfUEFUVEVSTi50ZXN0KHVzZXJBZ2VudCkpIHJldHVybiBudWxsO1xuXG4gIGxldCB1cmw6IFVSTDtcbiAgdHJ5IHtcbiAgICB1cmwgPSBuZXcgVVJMKHJlcXVlc3RVcmwsIFNJVEVfVVJMKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBzZWdtZW50cyA9IHVybC5wYXRobmFtZS5zcGxpdChcIi9cIikuZmlsdGVyKEJvb2xlYW4pO1xuICBjb25zdCBwb3N0SWQgPSBzZWdtZW50c1swXSA9PT0gXCJwb3N0XCIgPyBzZWdtZW50c1sxXSA6IHVuZGVmaW5lZDtcbiAgY29uc3QgZnJhbWVDb2RlID1cbiAgICB1cmwucGF0aG5hbWUgPT09IFwiL1wiID8gdXJsLnNlYXJjaFBhcmFtcy5nZXQoXCJmcmFtZVwiKT8udHJpbSgpIDogdW5kZWZpbmVkO1xuICBpZiAoIXBvc3RJZCAmJiAhZnJhbWVDb2RlKSByZXR1cm4gbnVsbDtcblxuICBjb25zdCBzdXBhYmFzZVVybCA9XG4gICAgZW52aXJvbm1lbnQuVklURV9TVVBBQkFTRV9VUkwgfHwgZW52aXJvbm1lbnQuU1VQQUJBU0VfVVJMIHx8IFwiXCI7XG4gIGNvbnN0IGFub25LZXkgPVxuICAgIGVudmlyb25tZW50LlZJVEVfU1VQQUJBU0VfQU5PTl9LRVkgfHxcbiAgICBlbnZpcm9ubWVudC5TVVBBQkFTRV9BTk9OX0tFWSB8fFxuICAgIFwiXCI7XG4gIGlmICghc3VwYWJhc2VVcmwgfHwgIWFub25LZXkpIHJldHVybiBudWxsO1xuXG4gIHRyeSB7XG4gICAgbGV0IHRpdGxlOiBzdHJpbmc7XG4gICAgbGV0IGRlc2NyaXB0aW9uOiBzdHJpbmc7XG4gICAgbGV0IGltYWdlVXJsOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgbGV0IGNhbm9uaWNhbFVybDogc3RyaW5nO1xuXG4gICAgaWYgKHBvc3RJZCkge1xuICAgICAgY29uc3QgZGVjb2RlZElkID0gZGVjb2RlVVJJQ29tcG9uZW50KHBvc3RJZCk7XG4gICAgICBjb25zdCBwb3N0ID0gYXdhaXQgZmV0Y2hQdWJsaWNSb3coXG4gICAgICAgIHN1cGFiYXNlVXJsLFxuICAgICAgICBhbm9uS2V5LFxuICAgICAgICBcInBvc3RzXCIsXG4gICAgICAgIHsgaWQ6IGBlcS4ke2RlY29kZWRJZH1gIH0sXG4gICAgICAgIFwiaWQsY29udGVudCxtZWRpYV91cmwsaW1hZ2VfdXJscyxjb3Zlcl91cmwsdHlwZSxtZXRhZGF0YSxhdXRob3JcIixcbiAgICAgICk7XG4gICAgICBpZiAoIXBvc3QpIHJldHVybiBudWxsO1xuXG4gICAgICB0aXRsZSA9XG4gICAgICAgIFN0cmluZyhwb3N0LmNvbnRlbnQgfHwgXCJcIikuc2xpY2UoMCwgNjApLnRyaW0oKSB8fFxuICAgICAgICBcIkZsaWNrcyBJbmRpYSBQb3N0XCI7XG4gICAgICBkZXNjcmlwdGlvbiA9XG4gICAgICAgIFN0cmluZyhwb3N0LmNvbnRlbnQgfHwgXCJcIikuc2xpY2UoMCwgMTYwKS50cmltKCkgfHxcbiAgICAgICAgXCJDaGVjayBvdXQgdGhpcyBwb3N0IG9uIEZsaWNrcyBJbmRpYS5cIjtcbiAgICAgIGltYWdlVXJsID0gcmVzb2x2ZVNvY2lhbEltYWdlKHBvc3QpO1xuICAgICAgY2Fub25pY2FsVXJsID0gYCR7U0lURV9VUkx9L3Bvc3QvJHtlbmNvZGVVUklDb21wb25lbnQocG9zdC5pZCl9YDtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgcmVxdWVzdEl0ZW0gPSBhd2FpdCBmZXRjaFB1YmxpY1JvdyhcbiAgICAgICAgc3VwYWJhc2VVcmwsXG4gICAgICAgIGFub25LZXksXG4gICAgICAgIFwiZnJhbWVfcmVxdWVzdHNcIixcbiAgICAgICAgeyByZXF1ZXN0X2NvZGU6IGBlcS4ke2ZyYW1lQ29kZX1gIH0sXG4gICAgICAgIFwiaWQscmVxdWVzdF9jb2RlLG5lZWR5X25hbWUsbmVlZHlfcGhvdG9fdXJsLGNhdGVnb3J5LGRlc2NyaXB0aW9uXCIsXG4gICAgICApO1xuICAgICAgaWYgKCFyZXF1ZXN0SXRlbSkgcmV0dXJuIG51bGw7XG5cbiAgICAgIGNvbnN0IG5lZWR5TmFtZSA9IFN0cmluZyhyZXF1ZXN0SXRlbS5uZWVkeV9uYW1lIHx8IFwiXCIpLnRyaW0oKSB8fCBcInNvbWVvbmUgaW4gbmVlZFwiO1xuICAgICAgY29uc3QgY2F0ZWdvcnkgPSBTdHJpbmcocmVxdWVzdEl0ZW0uY2F0ZWdvcnkgfHwgXCJcIikudHJpbSgpO1xuICAgICAgdGl0bGUgPSBgSGVscCAke25lZWR5TmFtZX0gXHUyMDE0IEZsaWNrcyBGcmFtZWA7XG4gICAgICBkZXNjcmlwdGlvbiA9XG4gICAgICAgIFN0cmluZyhyZXF1ZXN0SXRlbS5kZXNjcmlwdGlvbiB8fCBcIlwiKS50cmltKCkgfHxcbiAgICAgICAgKGNhdGVnb3J5XG4gICAgICAgICAgPyBgSGVscCB3aXRoICR7Y2F0ZWdvcnl9IHRocm91Z2ggRmxpY2tzIEZyYW1lLmBcbiAgICAgICAgICA6IFwiSGVscCBzb21lb25lIGluIG5lZWQgdGhyb3VnaCBGbGlja3MgRnJhbWUuXCIpO1xuICAgICAgaW1hZ2VVcmwgPSByZXNvbHZlU29jaWFsSW1hZ2Uoe1xuICAgICAgICB0eXBlOiBcInBvc3RcIixcbiAgICAgICAgbWVkaWFfdXJsOiByZXF1ZXN0SXRlbS5uZWVkeV9waG90b191cmwsXG4gICAgICB9KTtcbiAgICAgIGNhbm9uaWNhbFVybCA9IGAke1NJVEVfVVJMfS8/ZnJhbWU9JHtlbmNvZGVVUklDb21wb25lbnQocmVxdWVzdEl0ZW0ucmVxdWVzdF9jb2RlIHx8IGZyYW1lQ29kZSl9YDtcbiAgICB9XG5cbiAgICBjb25zdCBzYWZlVGl0bGUgPSBlc2NhcGVIdG1sKHRpdGxlKTtcbiAgICBjb25zdCBzYWZlRGVzY3JpcHRpb24gPSBlc2NhcGVIdG1sKGRlc2NyaXB0aW9uKTtcbiAgICAvLyBVc2UgdGhlIGFwcCBiYW5uZXIgb25seSB3aGVuIHRoaXMgc2hhcmVkIGl0ZW0gaGFzIG5vIHVzYWJsZSBtZWRpYSBVUkwuXG4gICAgY29uc3Qgc2FmZUltYWdlID0gZXNjYXBlSHRtbChpbWFnZVVybCB8fCBERUZBVUxUX0lNQUdFKTtcbiAgICBjb25zdCBzYWZlQ2Fub25pY2FsVXJsID0gZXNjYXBlSHRtbChjYW5vbmljYWxVcmwpO1xuICAgIGNvbnN0IGh0bWwgPSBgPCFET0NUWVBFIGh0bWw+XG48aHRtbCBsYW5nPVwiZW5cIj5cbjxoZWFkPlxuICA8bWV0YSBjaGFyc2V0PVwiVVRGLThcIiAvPlxuICA8bWV0YSBuYW1lPVwidmlld3BvcnRcIiBjb250ZW50PVwid2lkdGg9ZGV2aWNlLXdpZHRoLCBpbml0aWFsLXNjYWxlPTFcIiAvPlxuICA8dGl0bGU+JHtzYWZlVGl0bGV9IHwgRmxpY2tzIEluZGlhPC90aXRsZT5cbiAgPG1ldGEgbmFtZT1cImRlc2NyaXB0aW9uXCIgY29udGVudD1cIiR7c2FmZURlc2NyaXB0aW9ufVwiIC8+XG4gIDxtZXRhIHByb3BlcnR5PVwib2c6dHlwZVwiIGNvbnRlbnQ9XCJhcnRpY2xlXCIgLz5cbiAgPG1ldGEgcHJvcGVydHk9XCJvZzpzaXRlX25hbWVcIiBjb250ZW50PVwiRmxpY2tzIEluZGlhXCIgLz5cbiAgPG1ldGEgcHJvcGVydHk9XCJvZzp0aXRsZVwiIGNvbnRlbnQ9XCIke3NhZmVUaXRsZX1cIiAvPlxuICA8bWV0YSBwcm9wZXJ0eT1cIm9nOmRlc2NyaXB0aW9uXCIgY29udGVudD1cIiR7c2FmZURlc2NyaXB0aW9ufVwiIC8+XG4gIDxtZXRhIHByb3BlcnR5PVwib2c6aW1hZ2VcIiBjb250ZW50PVwiJHtzYWZlSW1hZ2V9XCIgLz5cbiAgPG1ldGEgcHJvcGVydHk9XCJvZzppbWFnZTpzZWN1cmVfdXJsXCIgY29udGVudD1cIiR7c2FmZUltYWdlfVwiIC8+XG4gIDxtZXRhIHByb3BlcnR5PVwib2c6aW1hZ2U6YWx0XCIgY29udGVudD1cIiR7c2FmZVRpdGxlfVwiIC8+XG4gIDxtZXRhIHByb3BlcnR5PVwib2c6dXJsXCIgY29udGVudD1cIiR7c2FmZUNhbm9uaWNhbFVybH1cIiAvPlxuICA8bWV0YSBuYW1lPVwidHdpdHRlcjpjYXJkXCIgY29udGVudD1cInN1bW1hcnlfbGFyZ2VfaW1hZ2VcIiAvPlxuICA8bWV0YSBuYW1lPVwidHdpdHRlcjp0aXRsZVwiIGNvbnRlbnQ9XCIke3NhZmVUaXRsZX1cIiAvPlxuICA8bWV0YSBuYW1lPVwidHdpdHRlcjpkZXNjcmlwdGlvblwiIGNvbnRlbnQ9XCIke3NhZmVEZXNjcmlwdGlvbn1cIiAvPlxuICA8bWV0YSBuYW1lPVwidHdpdHRlcjppbWFnZVwiIGNvbnRlbnQ9XCIke3NhZmVJbWFnZX1cIiAvPlxuICA8bWV0YSBwcm9wZXJ0eT1cInR3aXR0ZXI6aW1hZ2VcIiBjb250ZW50PVwiJHtzYWZlSW1hZ2V9XCIgLz5cbiAgPGxpbmsgcmVsPVwiY2Fub25pY2FsXCIgaHJlZj1cIiR7c2FmZUNhbm9uaWNhbFVybH1cIiAvPlxuPC9oZWFkPlxuPGJvZHk+XG4gIDxtYWluPlxuICAgIDxoMT4ke3NhZmVUaXRsZX08L2gxPlxuICAgIDxwPiR7c2FmZURlc2NyaXB0aW9ufTwvcD5cbiAgICA8YSBocmVmPVwiJHtzYWZlQ2Fub25pY2FsVXJsfVwiPk9wZW4gb24gRmxpY2tzIEluZGlhPC9hPlxuICA8L21haW4+XG48L2JvZHk+XG48L2h0bWw+YDtcblxuICAgIHJldHVybiBuZXcgUmVzcG9uc2UoaHRtbCwge1xuICAgICAgc3RhdHVzOiAyMDAsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwidGV4dC9odG1sOyBjaGFyc2V0PXV0Zi04XCIsXG4gICAgICAgIFwiQ2FjaGUtQ29udHJvbFwiOiBcInB1YmxpYywgbWF4LWFnZT02MCwgcy1tYXhhZ2U9NjAsIHN0YWxlLXdoaWxlLXJldmFsaWRhdGU9MzAwXCIsXG4gICAgICB9LFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJbc2hhcmUtbWV0YWRhdGFdIHJlbmRlciBmYWlsZWQ6XCIsIGVycm9yKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFvUCxTQUFTLG9CQUE0QjtBQUN6UixPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLE9BQU8sUUFBUTs7O0FDSDZRLElBQU0sV0FBVztBQUM3UyxJQUFNLGdCQUFnQjtBQUN0QixJQUFNLGNBQ0o7QUFTRixTQUFTLFdBQVcsT0FBd0I7QUFDMUMsU0FBTyxPQUFPLFNBQVMsRUFBRSxFQUN0QixRQUFRLE1BQU0sT0FBTyxFQUNyQixRQUFRLE1BQU0sUUFBUSxFQUN0QixRQUFRLE1BQU0sTUFBTSxFQUNwQixRQUFRLE1BQU0sTUFBTTtBQUN6QjtBQUVBLFNBQVMsZ0JBQWdCLE9BQW9DO0FBQzNELE1BQUksQ0FBQyxNQUFPLFFBQU87QUFDbkIsTUFBSTtBQUNGLFVBQU0sU0FBUyxJQUFJLElB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
