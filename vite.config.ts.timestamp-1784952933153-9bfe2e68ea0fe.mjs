// vite.config.ts
import { defineConfig } from "file:///home/runner/workspace/node_modules/vite/dist/node/index.js";
import react from "file:///home/runner/workspace/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import fs from "fs";
var __vite_injected_original_dirname = "/home/runner/workspace";
function sitemapPlugin() {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
  const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
  const BASE_URL = "https://flicksindia.online";
  const PAGE_SIZE = 1e3;
  const TTL_MS = 60 * 60 * 1e3;
  let cache = null;
  async function buildSitemapXml() {
    const { createClient } = await import("file:///home/runner/workspace/node_modules/@supabase/supabase-js/dist/index.mjs");
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    });
    const rows = [];
    let from = 0;
    while (true) {
      const { data, error } = await sb.from("posts").select("id, updated_at, created_at").eq("visibility", "public").order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
      if (error || !data || data.length === 0) break;
      rows.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
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
  plugins: [react(), sitemapPlugin(), apkDownloadPlugin()],
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
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      external: ["onnxruntime-web", "onnxruntime-web/webgpu", "@imgly/background-removal"],
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9ydW5uZXIvd29ya3NwYWNlXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9ydW5uZXIvd29ya3NwYWNlL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3J1bm5lci93b3Jrc3BhY2Uvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcsIFBsdWdpbiB9IGZyb20gXCJ2aXRlXCI7XG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0LXN3Y1wiO1xuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcbmltcG9ydCBmcyBmcm9tIFwiZnNcIjtcblxuLy8gXHUyNTAwXHUyNTAwIFNpdGVtYXAgbWlkZGxld2FyZSBwbHVnaW4gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBTZXJ2ZXMgL3NpdGVtYXAueG1sIGluIGRldiArIHByZXZpZXcgd2l0aCBhIDEtaG91ciBpbi1tZW1vcnkgY2FjaGUgc29cbi8vIEdvb2dsZWJvdCBuZXZlciB0cmlnZ2VycyBhIGxpdmUgU3VwYWJhc2UgaGl0IG9uIHJlcGVhdCBjcmF3bHMuXG4vLyBJbiBwcm9kdWN0aW9uIHRoZSBzdGF0aWMgcHVibGljL3NpdGVtYXAueG1sICh3cml0dGVuIGJ5IHByZWJ1aWxkKSBpcyBzZXJ2ZWRcbi8vIGFzIGEgcGxhaW4gZmlsZSBcdTIwMTQgdGhpcyBwbHVnaW4gYWRkcyB0aGUgQ2FjaGUtQ29udHJvbCBoZWFkZXIgdG8gdGhhdCB0b28uXG5mdW5jdGlvbiBzaXRlbWFwUGx1Z2luKCk6IFBsdWdpbiB7XG4gIGNvbnN0IFNVUEFCQVNFX1VSTCA9IHByb2Nlc3MuZW52LlZJVEVfU1VQQUJBU0VfVVJMIHx8IFwiXCI7XG4gIGNvbnN0IFNVUEFCQVNFX0tFWSA9IHByb2Nlc3MuZW52LlZJVEVfU1VQQUJBU0VfQU5PTl9LRVkgfHwgXCJcIjtcbiAgY29uc3QgQkFTRV9VUkwgPSBcImh0dHBzOi8vZmxpY2tzaW5kaWEub25saW5lXCI7XG4gIGNvbnN0IFBBR0VfU0laRSA9IDEwMDA7XG4gIGNvbnN0IFRUTF9NUyA9IDYwICogNjAgKiAxMDAwOyAvLyAxIGhvdXJcblxuICAvLyBNb2R1bGUtbGV2ZWwgY2FjaGUgXHUyMDE0IHN1cnZpdmVzIHRoZSBlbnRpcmUgVml0ZSBkZXYtc2VydmVyIHNlc3Npb25cbiAgbGV0IGNhY2hlOiB7IHhtbDogc3RyaW5nOyBidWlsdEF0OiBudW1iZXIgfSB8IG51bGwgPSBudWxsO1xuXG4gIGFzeW5jIGZ1bmN0aW9uIGJ1aWxkU2l0ZW1hcFhtbCgpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIC8vIExhenktaW1wb3J0IHN1cGFiYXNlLWpzIHNvIHRoZSBwbHVnaW4gb25seSBwdWxscyBpdCBpbiB3aGVuIG5lZWRlZFxuICAgIGNvbnN0IHsgY3JlYXRlQ2xpZW50IH0gPSBhd2FpdCBpbXBvcnQoXCJAc3VwYWJhc2Uvc3VwYWJhc2UtanNcIik7XG4gICAgY29uc3Qgc2IgPSBjcmVhdGVDbGllbnQoU1VQQUJBU0VfVVJMLCBTVVBBQkFTRV9LRVksIHtcbiAgICAgIGF1dGg6IHsgcGVyc2lzdFNlc3Npb246IGZhbHNlIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCByb3dzOiB7IGlkOiBzdHJpbmc7IHVwZGF0ZWRfYXQ/OiBzdHJpbmc7IGNyZWF0ZWRfYXQ/OiBzdHJpbmcgfVtdID0gW107XG4gICAgbGV0IGZyb20gPSAwO1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBjb25zdCB7IGRhdGEsIGVycm9yIH0gPSBhd2FpdCBzYlxuICAgICAgICAuZnJvbShcInBvc3RzXCIpXG4gICAgICAgIC5zZWxlY3QoXCJpZCwgdXBkYXRlZF9hdCwgY3JlYXRlZF9hdFwiKVxuICAgICAgICAuZXEoXCJ2aXNpYmlsaXR5XCIsIFwicHVibGljXCIpXG4gICAgICAgIC5vcmRlcihcImNyZWF0ZWRfYXRcIiwgeyBhc2NlbmRpbmc6IGZhbHNlIH0pXG4gICAgICAgIC5yYW5nZShmcm9tLCBmcm9tICsgUEFHRV9TSVpFIC0gMSk7XG4gICAgICBpZiAoZXJyb3IgfHwgIWRhdGEgfHwgZGF0YS5sZW5ndGggPT09IDApIGJyZWFrO1xuICAgICAgcm93cy5wdXNoKC4uLmRhdGEpO1xuICAgICAgaWYgKGRhdGEubGVuZ3RoIDwgUEFHRV9TSVpFKSBicmVhaztcbiAgICAgIGZyb20gKz0gUEFHRV9TSVpFO1xuICAgIH1cblxuICAgIGNvbnN0IGVzYyA9IChzOiBzdHJpbmcpID0+XG4gICAgICBzLnJlcGxhY2UoLyYvZywgXCImYW1wO1wiKS5yZXBsYWNlKC88L2csIFwiJmx0O1wiKS5yZXBsYWNlKC8+L2csIFwiJmd0O1wiKTtcbiAgICBjb25zdCBkID0gKHJhdz86IHN0cmluZykgPT4ge1xuICAgICAgdHJ5IHsgcmV0dXJuIG5ldyBEYXRlKHJhdyEpLnRvSVNPU3RyaW5nKCkuc3BsaXQoXCJUXCIpWzBdOyB9XG4gICAgICBjYXRjaCB7IHJldHVybiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkuc3BsaXQoXCJUXCIpWzBdOyB9XG4gICAgfTtcblxuICAgIGNvbnN0IHVybEVudHJpZXMgPSByb3dzXG4gICAgICAubWFwKFxuICAgICAgICAocikgPT5cbiAgICAgICAgICBgICA8dXJsPlxcbmAgK1xuICAgICAgICAgIGAgICAgPGxvYz4ke2VzYyhgJHtCQVNFX1VSTH0vcG9zdC8ke3IuaWR9YCl9PC9sb2M+XFxuYCArXG4gICAgICAgICAgYCAgICA8bGFzdG1vZD4ke2Qoci51cGRhdGVkX2F0IHx8IHIuY3JlYXRlZF9hdCl9PC9sYXN0bW9kPlxcbmAgK1xuICAgICAgICAgIGAgICAgPGNoYW5nZWZyZXE+d2Vla2x5PC9jaGFuZ2VmcmVxPlxcbmAgK1xuICAgICAgICAgIGAgICAgPHByaW9yaXR5PjAuNzwvcHJpb3JpdHk+XFxuYCArXG4gICAgICAgICAgYCAgPC91cmw+YCxcbiAgICAgIClcbiAgICAgIC5qb2luKFwiXFxuXCIpO1xuXG4gICAgcmV0dXJuIChcbiAgICAgIGA8P3htbCB2ZXJzaW9uPVwiMS4wXCIgZW5jb2Rpbmc9XCJVVEYtOFwiPz5cXG5gICtcbiAgICAgIGA8dXJsc2V0IHhtbG5zPVwiaHR0cDovL3d3dy5zaXRlbWFwcy5vcmcvc2NoZW1hcy9zaXRlbWFwLzAuOVwiPlxcbmAgK1xuICAgICAgYCAgPHVybD5cXG4gICAgPGxvYz4ke2VzYyhCQVNFX1VSTCl9LzwvbG9jPlxcbiAgICA8Y2hhbmdlZnJlcT5kYWlseTwvY2hhbmdlZnJlcT5cXG4gICAgPHByaW9yaXR5PjEuMDwvcHJpb3JpdHk+XFxuICA8L3VybD5cXG5gICtcbiAgICAgICh1cmxFbnRyaWVzID8gdXJsRW50cmllcyArIFwiXFxuXCIgOiBcIlwiKSArXG4gICAgICBgPC91cmxzZXQ+XFxuYFxuICAgICk7XG4gIH1cblxuICAvLyBTaGFyZWQgaGFuZGxlciBcdTIwMTQgdXNlZCBieSBib3RoIGNvbmZpZ3VyZVNlcnZlciBhbmQgY29uZmlndXJlUHJldmlld1NlcnZlclxuICBmdW5jdGlvbiBhdHRhY2hTaXRlbWFwSGFuZGxlcihtaWRkbGV3YXJlczogYW55KSB7XG4gICAgbWlkZGxld2FyZXMudXNlKFxuICAgICAgXCIvc2l0ZW1hcC54bWxcIixcbiAgICAgIGFzeW5jIChyZXE6IGFueSwgcmVzOiBhbnksIG5leHQ6IGFueSkgPT4ge1xuICAgICAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuXG4gICAgICAgIC8vIDEuIFJldHVybiBpbi1tZW1vcnkgY2FjaGUgaWYgc3RpbGwgZnJlc2hcbiAgICAgICAgaWYgKGNhY2hlICYmIG5vdyAtIGNhY2hlLmJ1aWx0QXQgPCBUVExfTVMpIHtcbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24veG1sOyBjaGFyc2V0PXV0Zi04XCIpO1xuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDYWNoZS1Db250cm9sXCIsIFwicHVibGljLCBtYXgtYWdlPTM2MDBcIik7XG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIlgtU2l0ZW1hcC1DYWNoZVwiLCBcIkhJVFwiKTtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDIwMDtcbiAgICAgICAgICByZXMuZW5kKGNhY2hlLnhtbCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gMi4gVHJ5IHRvIHNlcnZlIHRoZSBwcmUtYnVpbHQgc3RhdGljIGZpbGUgKHdyaXR0ZW4gYnkgYHByZWJ1aWxkYClcbiAgICAgICAgY29uc3Qgc3RhdGljUGF0aCA9IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwicHVibGljXCIsIFwic2l0ZW1hcC54bWxcIik7XG4gICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHN0YXRpY1BhdGgpKSB7XG4gICAgICAgICAgY29uc3QgeG1sID0gZnMucmVhZEZpbGVTeW5jKHN0YXRpY1BhdGgsIFwidXRmOFwiKTtcbiAgICAgICAgICBjYWNoZSA9IHsgeG1sLCBidWlsdEF0OiBub3cgfTtcbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24veG1sOyBjaGFyc2V0PXV0Zi04XCIpO1xuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDYWNoZS1Db250cm9sXCIsIFwicHVibGljLCBtYXgtYWdlPTM2MDBcIik7XG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIlgtU2l0ZW1hcC1DYWNoZVwiLCBcIkZJTEVcIik7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSAyMDA7XG4gICAgICAgICAgcmVzLmVuZCh4bWwpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIDMuIEZhbGxiYWNrIFx1MjAxNCBnZW5lcmF0ZSBsaXZlIGZyb20gU3VwYWJhc2UgKGZpcnN0LWV2ZXIgZGV2IGNvbGQgc3RhcnQpXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgeG1sID0gYXdhaXQgYnVpbGRTaXRlbWFwWG1sKCk7XG4gICAgICAgICAgY2FjaGUgPSB7IHhtbCwgYnVpbHRBdDogbm93IH07XG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL3htbDsgY2hhcnNldD11dGYtOFwiKTtcbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ2FjaGUtQ29udHJvbFwiLCBcInB1YmxpYywgbWF4LWFnZT0zNjAwXCIpO1xuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJYLVNpdGVtYXAtQ2FjaGVcIiwgXCJMSVZFXCIpO1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gMjAwO1xuICAgICAgICAgIHJlcy5lbmQoeG1sKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihcIltzaXRlbWFwXSBnZW5lcmF0aW9uIGZhaWxlZDpcIiwgZXJyKTtcbiAgICAgICAgICBuZXh0KCk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgbmFtZTogXCJmbGlja3Mtc2l0ZW1hcFwiLFxuICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHsgYXR0YWNoU2l0ZW1hcEhhbmRsZXIoc2VydmVyLm1pZGRsZXdhcmVzKTsgfSxcbiAgICBjb25maWd1cmVQcmV2aWV3U2VydmVyKHNlcnZlcikgeyBhdHRhY2hTaXRlbWFwSGFuZGxlcihzZXJ2ZXIubWlkZGxld2FyZXMpOyB9LFxuICB9O1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgQVBLIGRvd25sb2FkIG1pZGRsZXdhcmUgcGx1Z2luIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy8gU2VydmVzIC9kb3dubG9hZC9hcGsgXHUyMTkyIGFwcC1yZWxlYXNlLXNpZ25lZC5hcGsgKG9yIHB1YmxpYy9hcHAuYXBrIGZhbGxiYWNrKVxuLy8gd2l0aCBjb3JyZWN0IENvbnRlbnQtVHlwZSBhbmQgQ29udGVudC1EaXNwb3NpdGlvbiBzbyBicm93c2VycyB0cmlnZ2VyIGEgc2F2ZS5cbi8vIFRoZSBiaW5hcnkgaXMgZ2l0aWdub3JlZCBzbyB0aGlzIG9ubHkgcnVucyBpbiB0aGUgUmVwbGl0IGRldiBlbnZpcm9ubWVudC5cbmZ1bmN0aW9uIGFwa0Rvd25sb2FkUGx1Z2luKCk6IFBsdWdpbiB7XG4gIGNvbnN0IGNhbmRpZGF0ZXMgPSBbXG4gICAgcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCJhcHAtcmVsZWFzZS1zaWduZWQuYXBrXCIpLFxuICAgIHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwicHVibGljXCIsIFwiYXBwLmFwa1wiKSxcbiAgXTtcblxuICBmdW5jdGlvbiBhdHRhY2hBcGtIYW5kbGVyKG1pZGRsZXdhcmVzOiBhbnkpIHtcbiAgICBtaWRkbGV3YXJlcy51c2UoXCIvZG93bmxvYWQvYXBrXCIsIChyZXE6IGFueSwgcmVzOiBhbnksIG5leHQ6IGFueSkgPT4ge1xuICAgICAgY29uc3QgYXBrUGF0aCA9IGNhbmRpZGF0ZXMuZmluZChmcy5leGlzdHNTeW5jKTtcbiAgICAgIGlmICghYXBrUGF0aCkge1xuICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDQwNDtcbiAgICAgICAgcmVzLmVuZChcIkFQSyBub3QgZm91bmQgb24gZGlzay5cIik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHN0YXQgPSBmcy5zdGF0U3luYyhhcGtQYXRoKTtcbiAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi92bmQuYW5kcm9pZC5wYWNrYWdlLWFyY2hpdmVcIik7XG4gICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1EaXNwb3NpdGlvblwiLCAnYXR0YWNobWVudDsgZmlsZW5hbWU9XCJGbGlja3NJbmRpYS5hcGtcIicpO1xuICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtTGVuZ3RoXCIsIHN0YXQuc2l6ZSk7XG4gICAgICByZXMuc2V0SGVhZGVyKFwiQ2FjaGUtQ29udHJvbFwiLCBcIm5vLXN0b3JlXCIpO1xuICAgICAgcmVzLnN0YXR1c0NvZGUgPSAyMDA7XG4gICAgICBmcy5jcmVhdGVSZWFkU3RyZWFtKGFwa1BhdGgpLnBpcGUocmVzKTtcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgbmFtZTogXCJmbGlja3MtYXBrLWRvd25sb2FkXCIsXG4gICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikgeyBhdHRhY2hBcGtIYW5kbGVyKHNlcnZlci5taWRkbGV3YXJlcyk7IH0sXG4gICAgY29uZmlndXJlUHJldmlld1NlcnZlcihzZXJ2ZXIpIHsgYXR0YWNoQXBrSGFuZGxlcihzZXJ2ZXIubWlkZGxld2FyZXMpOyB9LFxuICB9O1xufVxuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBiYXNlOiBcIi9cIixcblxuICBzZXJ2ZXI6IHtcbiAgICBob3N0OiBcIjAuMC4wLjBcIixcbiAgICBwb3J0OiA1MDAwLFxuICAgIGFsbG93ZWRIb3N0czogdHJ1ZSxcbiAgICBobXI6IHsgb3ZlcmxheTogZmFsc2UgfSxcbiAgICBoZWFkZXJzOiB7XG4gICAgICBcIkNhY2hlLUNvbnRyb2xcIjogXCJuby1zdG9yZSwgbm8tY2FjaGUsIG11c3QtcmV2YWxpZGF0ZSwgcHJveHktcmV2YWxpZGF0ZVwiLFxuICAgICAgXCJQcmFnbWFcIjogXCJuby1jYWNoZVwiLFxuICAgICAgXCJFeHBpcmVzXCI6IFwiMFwiLFxuICAgIH0sXG4gIH0sXG5cbiAgcHJldmlldzoge1xuICAgIGhvc3Q6IFwiMC4wLjAuMFwiLFxuICAgIHBvcnQ6IDUwMDAsXG4gICAgYWxsb3dlZEhvc3RzOiB0cnVlLFxuICB9LFxuXG4gIHBsdWdpbnM6IFtyZWFjdCgpLCBzaXRlbWFwUGx1Z2luKCksIGFwa0Rvd25sb2FkUGx1Z2luKCldLFxuXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczogeyBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSB9LFxuICAgIGRlZHVwZTogW1xuICAgICAgXCJyZWFjdFwiLFxuICAgICAgXCJyZWFjdC1kb21cIixcbiAgICAgIFwicmVhY3QvanN4LXJ1bnRpbWVcIixcbiAgICAgIFwicmVhY3QvanN4LWRldi1ydW50aW1lXCIsXG4gICAgXSxcbiAgfSxcblxuICBidWlsZDoge1xuICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogNjAwLFxuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIGV4dGVybmFsOiBbXCJvbm54cnVudGltZS13ZWJcIiwgXCJvbm54cnVudGltZS13ZWIvd2ViZ3B1XCIsIFwiQGltZ2x5L2JhY2tncm91bmQtcmVtb3ZhbFwiXSxcbiAgICAgIG9ud2Fybih3YXJuaW5nLCB3YXJuKSB7XG4gICAgICAgIGlmICh3YXJuaW5nLmNvZGUgPT09IFwiQ0lSQ1VMQVJfREVQRU5ERU5DWVwiKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihcIlx1RDgzRFx1REQzNCBDSVJDVUxBUjpcIiwgd2FybmluZy5tZXNzYWdlKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgd2Fybih3YXJuaW5nKTtcbiAgICAgIH0sXG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgbWFudWFsQ2h1bmtzOiAoaWQ6IHN0cmluZykgPT4ge1xuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL3JlYWN0L1wiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvcmVhY3QtZG9tL1wiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvc2NoZWR1bGVyL1wiKVxuICAgICAgICAgIClcbiAgICAgICAgICAgIHJldHVybiBcInZlbmRvci1yZWFjdFwiO1xuXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL2ZyYW1lci1tb3Rpb25cIikpIHJldHVybiBcInZlbmRvci1mcmFtZXJcIjtcblxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9sdWNpZGUtcmVhY3RcIikpIHJldHVybiBcInZlbmRvci1sdWNpZGVcIjtcblxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9Ac3VwYWJhc2VcIikpIHJldHVybiBcInZlbmRvci1zdXBhYmFzZVwiO1xuXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL0B0YW5zdGFja1wiKSkgcmV0dXJuIFwidmVuZG9yLXF1ZXJ5XCI7XG5cbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9AcmFkaXgtdWlcIikgfHxcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL2NtZGtcIilcbiAgICAgICAgICApXG4gICAgICAgICAgICByZXR1cm4gXCJ2ZW5kb3ItdWlcIjtcblxuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL3JlYWN0LXJvdXRlclwiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvd291dGVyXCIpXG4gICAgICAgICAgKVxuICAgICAgICAgICAgcmV0dXJuIFwidmVuZG9yLXJvdXRlclwiO1xuXG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvQGltZ2x5XCIpIHx8XG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9vbm54cnVudGltZVwiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvb25ueFwiKVxuICAgICAgICAgIClcbiAgICAgICAgICAgIHJldHVybiBcInZlbmRvci1vbm54XCI7XG5cbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9hZ29yYVwiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvYWdvcmEtcnRjXCIpXG4gICAgICAgICAgKVxuICAgICAgICAgICAgcmV0dXJuIFwidmVuZG9yLWFnb3JhXCI7XG5cbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvcmVhY3QtaWNvbnNcIikpIHJldHVybiBcInZlbmRvci1pY29uc1wiO1xuXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL1wiKSkgcmV0dXJuIFwidmVuZG9yLW1pc2NcIjtcblxuICAgICAgICAgIC8vIFx1MjUwMFx1MjUwMCBMb2NhbCBzaGFyZWQgbW9kdWxlcyBcdTIwMTQgZ2l2ZSBlYWNoIGl0cyBvd24gc3RhYmxlIGNodW5rIHNvXG4gICAgICAgICAgLy8gICAgUm9sbHVwIGFsd2F5cyBpbml0aWFsaXNlcyB0aGVtIGJlZm9yZSBhbnkgZmVhdHVyZSBjaHVuayBcdTI1MDBcdTI1MDBcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCIvc3JjL2xpYi9zdXBhYmFzZUNsaWVudFwiKSkgcmV0dXJuIFwiYXBwLXN1cGFiYXNlXCI7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwiL3NyYy9saWIvYWRtaW5Db25maWdcIikpICAgIHJldHVybiBcImFwcC1hZG1pblwiO1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIi9zcmMvbGliL21lbnRpb25zXCIpKSAgICAgICByZXR1cm4gXCJhcHAtbWVudGlvbnNcIjtcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCIvc3JjL2xpYi9zaGFyZVBvc3RcIikpICAgICAgcmV0dXJuIFwiYXBwLXNoYXJlXCI7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwiL3NyYy9jb250ZXh0L1wiKSkgICAgICAgICAgIHJldHVybiBcImFwcC1jb250ZXh0XCI7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwiL3NyYy9ob29rcy9cIikpICAgICAgICAgICAgIHJldHVybiBcImFwcC1ob29rc1wiO1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIi9zcmMvY29tcG9uZW50cy9FcnJvckJvdW5kYXJ5XCIpKSByZXR1cm4gXCJhcHAtZXJyb3ItYm91bmRhcnlcIjtcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCIvc3JjL2NvbXBvbmVudHMvQXV0b1BsYXlNdXRlZFZpZGVvXCIpKSByZXR1cm4gXCJhcHAtYXV0b3BsYXlcIjtcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCIvc3JjL2NvbXBvbmVudHMvUmljaENhcHRpb25cIikpICByZXR1cm4gXCJhcHAtcmljaC1jYXB0aW9uXCI7XG4gICAgICAgIH0s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
