import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  logLevel: "warn",
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    reportCompressedSize: false,
    rollupOptions: {
      external: [],
      onwarn(warning, warn) {
        // Kisi bhi warning ko ignore karke build ko rokne se bachane ke liye
        return;
      },
    },
  },
});
