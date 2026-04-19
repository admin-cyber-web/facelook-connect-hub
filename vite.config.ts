import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  base: "/",

  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
    hmr: { overlay: false },
  },

  preview: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
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

  optimizeDeps: {
    exclude: ["onnxruntime-web", "@imgly/background-removal"],
  },

  assetsInclude: ["**/*.wasm"],

  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      external: ["onnxruntime-web", "onnxruntime-web/webgpu"],
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
        },
      },
    },
  },
});
