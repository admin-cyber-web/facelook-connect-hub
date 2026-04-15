import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  base: "/",

  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    hmr: { overlay: false },
  },

  plugins: [react()],

  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },

  // ── WASM Externalization ────────────────────────────────────────────────
  // Keep ONNX and background-removal out of Vite's pre-bundle step.
  optimizeDeps: {
    exclude: ["onnxruntime-web", "@imgly/background-removal"],
  },

  // Treat raw .wasm files as static assets
  assetsInclude: ["**/*.wasm"],

  // ── Build optimisation ──────────────────────────────────────────────────
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      // FIX: Dono modules ko externalize kiya hai taaki Rollup build na tute
      external: ["onnxruntime-web", "onnxruntime-web/webgpu"],
      output: {
        // ── Manual Chunks ─────────────────────────────────────────────────
        manualChunks: (id: string) => {
          // React core
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/")
          )
            return "vendor-react";

          // Framer Motion
          if (id.includes("node_modules/framer-motion")) return "vendor-framer";

          // Lucide icons
          if (id.includes("node_modules/lucide-react")) return "vendor-lucide";

          // Supabase client
          if (id.includes("node_modules/@supabase")) return "vendor-supabase";

          // TanStack Query
          if (id.includes("node_modules/@tanstack")) return "vendor-query";

          // Radix UI primitives
          if (
            id.includes("node_modules/@radix-ui") ||
            id.includes("node_modules/cmdk")
          )
            return "vendor-ui";

          // Routing
          if (
            id.includes("node_modules/react-router") ||
            id.includes("node_modules/wouter")
          )
            return "vendor-router";

          // ONNX / background-removal
          if (
            id.includes("node_modules/@imgly") ||
            id.includes("node_modules/onnxruntime") ||
            id.includes("node_modules/onnx")
          )
            return "vendor-onnx";

          // Agora RTC
          if (
            id.includes("node_modules/agora") ||
            id.includes("node_modules/agora-rtc")
          )
            return "vendor-agora";

          // react-icons
          if (id.includes("node_modules/react-icons")) return "vendor-icons";

          // Everything else
          if (id.includes("node_modules/")) return "vendor-misc";
        },
      },
    },
  },
});
