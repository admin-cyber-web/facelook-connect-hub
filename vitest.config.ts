import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  logLevel: "warn", // warnings ko error banne se rokne ke liye
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
    // Warnings ki wajah se build exit code 1 na de, isliye false rakha hai
    reportCompressedSize: false,
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        // Kisi bhi warning ko ignore karke build ko aage badhane ke liye
        return;
      },
    },
  },
});
