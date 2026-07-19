import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

// ── Sitemap middleware plugin ──────────────────────────────────────────────────
// Serves /sitemap.xml in dev + preview with a 1-hour in-memory cache so
// Googlebot never triggers a live Supabase hit on repeat crawls.
// In production the static public/sitemap.xml (written by prebuild) is served
// as a plain file — this plugin adds the Cache-Control header to that too.
function sitemapPlugin(): Plugin {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
  const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
  const BASE_URL = "https://flicksindia.online";
  const PAGE_SIZE = 1000;
  const TTL_MS = 60 * 60 * 1000; // 1 hour

  // Module-level cache — survives the entire Vite dev-server session
  let cache: { xml: string; builtAt: number } | null = null;

  async function buildSitemapXml(): Promise<string> {
    // Lazy-import supabase-js so the plugin only pulls it in when needed
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });

    const rows: { id: string; updated_at?: string; created_at?: string }[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await sb
        .from("posts")
        .select("id, updated_at, created_at")
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error || !data || data.length === 0) break;
      rows.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const d = (raw?: string) => {
      try { return new Date(raw!).toISOString().split("T")[0]; }
      catch { return new Date().toISOString().split("T")[0]; }
    };

    const urlEntries = rows
      .map(
        (r) =>
          `  <url>\n` +
          `    <loc>${esc(`${BASE_URL}/post/${r.id}`)}</loc>\n` +
          `    <lastmod>${d(r.updated_at || r.created_at)}</lastmod>\n` +
          `    <changefreq>weekly</changefreq>\n` +
          `    <priority>0.7</priority>\n` +
          `  </url>`,
      )
      .join("\n");

    return (
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      `  <url>\n    <loc>${esc(BASE_URL)}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n` +
      (urlEntries ? urlEntries + "\n" : "") +
      `</urlset>\n`
    );
  }

  // Shared handler — used by both configureServer and configurePreviewServer
  function attachSitemapHandler(middlewares: any) {
    middlewares.use(
      "/sitemap.xml",
      async (req: any, res: any, next: any) => {
        const now = Date.now();

        // 1. Return in-memory cache if still fresh
        if (cache && now - cache.builtAt < TTL_MS) {
          res.setHeader("Content-Type", "application/xml; charset=utf-8");
          res.setHeader("Cache-Control", "public, max-age=3600");
          res.setHeader("X-Sitemap-Cache", "HIT");
          res.statusCode = 200;
          res.end(cache.xml);
          return;
        }

        // 2. Try to serve the pre-built static file (written by `prebuild`)
        const staticPath = path.resolve(__dirname, "public", "sitemap.xml");
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

        // 3. Fallback — generate live from Supabase (first-ever dev cold start)
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
      },
    );
  }

  return {
    name: "flicks-sitemap",
    configureServer(server) { attachSitemapHandler(server.middlewares); },
    configurePreviewServer(server) { attachSitemapHandler(server.middlewares); },
  };
}

export default defineConfig({
  base: "/",

  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
    hmr: { overlay: false },
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  },

  preview: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
  },

  plugins: [react(), sitemapPlugin()],

  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },

  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      external: ["onnxruntime-web", "onnxruntime-web/webgpu", "@imgly/background-removal"],
      onwarn(warning, warn) {
        if (warning.code === "CIRCULAR_DEPENDENCY") {
          console.error("🔴 CIRCULAR:", warning.message);
          return;
        }
        warn(warning);
      },
      output: {
        manualChunks: (id: string) => {
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/")
          )
            return "vendor-react";

          if (id.includes("node_modules/framer-motion")) return "vendor-framer";

          if (id.includes("node_modules/lucide-react")) return "vendor-lucide";

          if (id.includes("node_modules/@supabase")) return "vendor-supabase";

          if (id.includes("node_modules/@tanstack")) return "vendor-query";

          if (
            id.includes("node_modules/@radix-ui") ||
            id.includes("node_modules/cmdk")
          )
            return "vendor-ui";

          if (
            id.includes("node_modules/react-router") ||
            id.includes("node_modules/wouter")
          )
            return "vendor-router";

          if (
            id.includes("node_modules/@imgly") ||
            id.includes("node_modules/onnxruntime") ||
            id.includes("node_modules/onnx")
          )
            return "vendor-onnx";

          if (
            id.includes("node_modules/agora") ||
            id.includes("node_modules/agora-rtc")
          )
            return "vendor-agora";

          if (id.includes("node_modules/react-icons")) return "vendor-icons";

          if (id.includes("node_modules/")) return "vendor-misc";

          // ── Local shared modules — give each its own stable chunk so
          //    Rollup always initialises them before any feature chunk ──
          if (id.includes("/src/lib/supabaseClient")) return "app-supabase";
          if (id.includes("/src/lib/adminConfig"))    return "app-admin";
          if (id.includes("/src/lib/mentions"))       return "app-mentions";
          if (id.includes("/src/lib/sharePost"))      return "app-share";
          if (id.includes("/src/context/"))           return "app-context";
          if (id.includes("/src/hooks/"))             return "app-hooks";
          if (id.includes("/src/components/ErrorBoundary")) return "app-error-boundary";
          if (id.includes("/src/components/AutoPlayMutedVideo")) return "app-autoplay";
          if (id.includes("/src/components/RichCaption"))  return "app-rich-caption";
        },
      },
    },
  },
});
