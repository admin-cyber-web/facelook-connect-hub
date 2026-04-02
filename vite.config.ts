import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
    hmr: { overlay: false },
  },

  plugins: [react()],

  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },

  // ── WASM Externalization ────────────────────────────────────────────────
  // Keep ONNX and background-removal out of Vite's pre-bundle step.
  // They ship their own WASM blobs; pre-bundling them bloats the main chunk.
  optimizeDeps: {
    exclude: ["onnxruntime-web", "@imgly/background-removal"],
  },

  // Treat raw .wasm files as static assets (not inlined JS)
  assetsInclude: ["**/*.wasm"],

  // ── Build optimisation ──────────────────────────────────────────────────
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // ── Manual Chunks ─────────────────────────────────────────────────
        // Each vendor group becomes a separate HTTP/2 cacheable chunk.
        manualChunks: (id: string) => {
          // React core (must stay together — React needs one copy)
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/")
          ) return "vendor-react";

          // Framer Motion (large — ~130 kB gzip)
          if (id.includes("node_modules/framer-motion")) return "vendor-framer";

          // Lucide icons (large icon set)
          if (id.includes("node_modules/lucide-react")) return "vendor-lucide";

          // Supabase client + realtime
          if (id.includes("node_modules/@supabase")) return "vendor-supabase";

          // TanStack Query
          if (id.includes("node_modules/@tanstack")) return "vendor-query";

          // Radix UI primitives + cmdk (shadcn base)
          if (
            id.includes("node_modules/@radix-ui") ||
            id.includes("node_modules/cmdk")
          ) return "vendor-ui";

          // Routing
          if (
            id.includes("node_modules/react-router") ||
            id.includes("node_modules/wouter")
          ) return "vendor-router";

          // ONNX / background-removal → own heavy chunk, loaded lazily
          if (
            id.includes("node_modules/@imgly") ||
            id.includes("node_modules/onnxruntime") ||
            id.includes("node_modules/onnx")
          ) return "vendor-onnx";

          // Agora RTC (very large SDK — keep isolated so it doesn't pollute misc)
          if (
            id.includes("node_modules/agora") ||
            id.includes("node_modules/agora-rtc")
          ) return "vendor-agora";

          // react-icons (large icon set)
          if (id.includes("node_modules/react-icons")) return "vendor-icons";

          // Everything else in node_modules → generic vendor
          if (id.includes("node_modules/")) return "vendor-misc";
        },
      },
    },
  },
});
