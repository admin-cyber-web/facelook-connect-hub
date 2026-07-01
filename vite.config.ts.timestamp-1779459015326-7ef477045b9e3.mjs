// vite.config.ts
import { defineConfig } from "file:///home/runner/workspace/node_modules/vite/dist/node/index.js";
import react from "file:///home/runner/workspace/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
var __vite_injected_original_dirname = "/home/runner/workspace";
var vite_config_default = defineConfig({
  base: "/",
  server: {
    host: "0.0.0.0",
    port: 5e3,
    allowedHosts: true,
    hmr: { overlay: false }
  },
  preview: {
    host: "0.0.0.0",
    port: 5e3,
    allowedHosts: true
  },
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__vite_injected_original_dirname, "./src") },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime"
    ]
  },
  optimizeDeps: {
    exclude: ["onnxruntime-web", "@imgly/background-removal"]
  },
  assetsInclude: ["**/*.wasm"],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      external: ["onnxruntime-web", "onnxruntime-web/webgpu"],
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9ydW5uZXIvd29ya3NwYWNlXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9ydW5uZXIvd29ya3NwYWNlL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3J1bm5lci93b3Jrc3BhY2Uvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIGJhc2U6IFwiL1wiLFxuXG4gIHNlcnZlcjoge1xuICAgIGhvc3Q6IFwiMC4wLjAuMFwiLFxuICAgIHBvcnQ6IDUwMDAsXG4gICAgYWxsb3dlZEhvc3RzOiB0cnVlLFxuICAgIGhtcjogeyBvdmVybGF5OiBmYWxzZSB9LFxuICB9LFxuXG4gIHByZXZpZXc6IHtcbiAgICBob3N0OiBcIjAuMC4wLjBcIixcbiAgICBwb3J0OiA1MDAwLFxuICAgIGFsbG93ZWRIb3N0czogdHJ1ZSxcbiAgfSxcblxuICBwbHVnaW5zOiBbcmVhY3QoKV0sXG5cbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7IFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpIH0sXG4gICAgZGVkdXBlOiBbXG4gICAgICBcInJlYWN0XCIsXG4gICAgICBcInJlYWN0LWRvbVwiLFxuICAgICAgXCJyZWFjdC9qc3gtcnVudGltZVwiLFxuICAgICAgXCJyZWFjdC9qc3gtZGV2LXJ1bnRpbWVcIixcbiAgICBdLFxuICB9LFxuXG4gIG9wdGltaXplRGVwczoge1xuICAgIGV4Y2x1ZGU6IFtcIm9ubnhydW50aW1lLXdlYlwiLCBcIkBpbWdseS9iYWNrZ3JvdW5kLXJlbW92YWxcIl0sXG4gIH0sXG5cbiAgYXNzZXRzSW5jbHVkZTogW1wiKiovKi53YXNtXCJdLFxuXG4gIGJ1aWxkOiB7XG4gICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiA2MDAsXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgZXh0ZXJuYWw6IFtcIm9ubnhydW50aW1lLXdlYlwiLCBcIm9ubnhydW50aW1lLXdlYi93ZWJncHVcIl0sXG4gICAgICBvbndhcm4od2FybmluZywgd2Fybikge1xuICAgICAgICBpZiAod2FybmluZy5jb2RlID09PSBcIkNJUkNVTEFSX0RFUEVOREVOQ1lcIikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJcdUQ4M0RcdUREMzQgQ0lSQ1VMQVI6XCIsIHdhcm5pbmcubWVzc2FnZSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHdhcm4od2FybmluZyk7XG4gICAgICB9LFxuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIG1hbnVhbENodW5rczogKGlkOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9yZWFjdC9cIikgfHxcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL3JlYWN0LWRvbS9cIikgfHxcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL3NjaGVkdWxlci9cIilcbiAgICAgICAgICApXG4gICAgICAgICAgICByZXR1cm4gXCJ2ZW5kb3ItcmVhY3RcIjtcblxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9mcmFtZXItbW90aW9uXCIpKSByZXR1cm4gXCJ2ZW5kb3ItZnJhbWVyXCI7XG5cbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvbHVjaWRlLXJlYWN0XCIpKSByZXR1cm4gXCJ2ZW5kb3ItbHVjaWRlXCI7XG5cbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvQHN1cGFiYXNlXCIpKSByZXR1cm4gXCJ2ZW5kb3Itc3VwYWJhc2VcIjtcblxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9AdGFuc3RhY2tcIikpIHJldHVybiBcInZlbmRvci1xdWVyeVwiO1xuXG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvQHJhZGl4LXVpXCIpIHx8XG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9jbWRrXCIpXG4gICAgICAgICAgKVxuICAgICAgICAgICAgcmV0dXJuIFwidmVuZG9yLXVpXCI7XG5cbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9yZWFjdC1yb3V0ZXJcIikgfHxcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL3dvdXRlclwiKVxuICAgICAgICAgIClcbiAgICAgICAgICAgIHJldHVybiBcInZlbmRvci1yb3V0ZXJcIjtcblxuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL0BpbWdseVwiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvb25ueHJ1bnRpbWVcIikgfHxcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL29ubnhcIilcbiAgICAgICAgICApXG4gICAgICAgICAgICByZXR1cm4gXCJ2ZW5kb3Itb25ueFwiO1xuXG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvYWdvcmFcIikgfHxcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL2Fnb3JhLXJ0Y1wiKVxuICAgICAgICAgIClcbiAgICAgICAgICAgIHJldHVybiBcInZlbmRvci1hZ29yYVwiO1xuXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL3JlYWN0LWljb25zXCIpKSByZXR1cm4gXCJ2ZW5kb3ItaWNvbnNcIjtcblxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9cIikpIHJldHVybiBcInZlbmRvci1taXNjXCI7XG5cbiAgICAgICAgICAvLyBcdTI1MDBcdTI1MDAgTG9jYWwgc2hhcmVkIG1vZHVsZXMgXHUyMDE0IGdpdmUgZWFjaCBpdHMgb3duIHN0YWJsZSBjaHVuayBzb1xuICAgICAgICAgIC8vICAgIFJvbGx1cCBhbHdheXMgaW5pdGlhbGlzZXMgdGhlbSBiZWZvcmUgYW55IGZlYXR1cmUgY2h1bmsgXHUyNTAwXHUyNTAwXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwiL3NyYy9saWIvc3VwYWJhc2VDbGllbnRcIikpIHJldHVybiBcImFwcC1zdXBhYmFzZVwiO1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIi9zcmMvbGliL2FkbWluQ29uZmlnXCIpKSAgICByZXR1cm4gXCJhcHAtYWRtaW5cIjtcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCIvc3JjL2xpYi9tZW50aW9uc1wiKSkgICAgICAgcmV0dXJuIFwiYXBwLW1lbnRpb25zXCI7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwiL3NyYy9saWIvc2hhcmVQb3N0XCIpKSAgICAgIHJldHVybiBcImFwcC1zaGFyZVwiO1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIi9zcmMvY29udGV4dC9cIikpICAgICAgICAgICByZXR1cm4gXCJhcHAtY29udGV4dFwiO1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIi9zcmMvaG9va3MvXCIpKSAgICAgICAgICAgICByZXR1cm4gXCJhcHAtaG9va3NcIjtcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCIvc3JjL2NvbXBvbmVudHMvRXJyb3JCb3VuZGFyeVwiKSkgcmV0dXJuIFwiYXBwLWVycm9yLWJvdW5kYXJ5XCI7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwiL3NyYy9jb21wb25lbnRzL0F1dG9QbGF5TXV0ZWRWaWRlb1wiKSkgcmV0dXJuIFwiYXBwLWF1dG9wbGF5XCI7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwiL3NyYy9jb21wb25lbnRzL1JpY2hDYXB0aW9uXCIpKSAgcmV0dXJuIFwiYXBwLXJpY2gtY2FwdGlvblwiO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQW9QLFNBQVMsb0JBQW9CO0FBQ2pSLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFGakIsSUFBTSxtQ0FBbUM7QUFJekMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsTUFBTTtBQUFBLEVBRU4sUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sY0FBYztBQUFBLElBQ2QsS0FBSyxFQUFFLFNBQVMsTUFBTTtBQUFBLEVBQ3hCO0FBQUEsRUFFQSxTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixjQUFjO0FBQUEsRUFDaEI7QUFBQSxFQUVBLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFBQSxFQUVqQixTQUFTO0FBQUEsSUFDUCxPQUFPLEVBQUUsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTyxFQUFFO0FBQUEsSUFDL0MsUUFBUTtBQUFBLE1BQ047QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBRUEsY0FBYztBQUFBLElBQ1osU0FBUyxDQUFDLG1CQUFtQiwyQkFBMkI7QUFBQSxFQUMxRDtBQUFBLEVBRUEsZUFBZSxDQUFDLFdBQVc7QUFBQSxFQUUzQixPQUFPO0FBQUEsSUFDTCx1QkFBdUI7QUFBQSxJQUN2QixlQUFlO0FBQUEsTUFDYixVQUFVLENBQUMsbUJBQW1CLHdCQUF3QjtBQUFBLE1BQ3RELE9BQU8sU0FBUyxNQUFNO0FBQ3BCLFlBQUksUUFBUSxTQUFTLHVCQUF1QjtBQUMxQyxrQkFBUSxNQUFNLHVCQUFnQixRQUFRLE9BQU87QUFDN0M7QUFBQSxRQUNGO0FBQ0EsYUFBSyxPQUFPO0FBQUEsTUFDZDtBQUFBLE1BQ0EsUUFBUTtBQUFBLFFBQ04sY0FBYyxDQUFDLE9BQWU7QUFDNUIsY0FDRSxHQUFHLFNBQVMscUJBQXFCLEtBQ2pDLEdBQUcsU0FBUyx5QkFBeUIsS0FDckMsR0FBRyxTQUFTLHlCQUF5QjtBQUVyQyxtQkFBTztBQUVULGNBQUksR0FBRyxTQUFTLDRCQUE0QixFQUFHLFFBQU87QUFFdEQsY0FBSSxHQUFHLFNBQVMsMkJBQTJCLEVBQUcsUUFBTztBQUVyRCxjQUFJLEdBQUcsU0FBUyx3QkFBd0IsRUFBRyxRQUFPO0FBRWxELGNBQUksR0FBRyxTQUFTLHdCQUF3QixFQUFHLFFBQU87QUFFbEQsY0FDRSxHQUFHLFNBQVMsd0JBQXdCLEtBQ3BDLEdBQUcsU0FBUyxtQkFBbUI7QUFFL0IsbUJBQU87QUFFVCxjQUNFLEdBQUcsU0FBUywyQkFBMkIsS0FDdkMsR0FBRyxTQUFTLHFCQUFxQjtBQUVqQyxtQkFBTztBQUVULGNBQ0UsR0FBRyxTQUFTLHFCQUFxQixLQUNqQyxHQUFHLFNBQVMsMEJBQTBCLEtBQ3RDLEdBQUcsU0FBUyxtQkFBbUI7QUFFL0IsbUJBQU87QUFFVCxjQUNFLEdBQUcsU0FBUyxvQkFBb0IsS0FDaEMsR0FBRyxTQUFTLHdCQUF3QjtBQUVwQyxtQkFBTztBQUVULGNBQUksR0FBRyxTQUFTLDBCQUEwQixFQUFHLFFBQU87QUFFcEQsY0FBSSxHQUFHLFNBQVMsZUFBZSxFQUFHLFFBQU87QUFJekMsY0FBSSxHQUFHLFNBQVMseUJBQXlCLEVBQUcsUUFBTztBQUNuRCxjQUFJLEdBQUcsU0FBUyxzQkFBc0IsRUFBTSxRQUFPO0FBQ25ELGNBQUksR0FBRyxTQUFTLG1CQUFtQixFQUFTLFFBQU87QUFDbkQsY0FBSSxHQUFHLFNBQVMsb0JBQW9CLEVBQVEsUUFBTztBQUNuRCxjQUFJLEdBQUcsU0FBUyxlQUFlLEVBQWEsUUFBTztBQUNuRCxjQUFJLEdBQUcsU0FBUyxhQUFhLEVBQWUsUUFBTztBQUNuRCxjQUFJLEdBQUcsU0FBUywrQkFBK0IsRUFBRyxRQUFPO0FBQ3pELGNBQUksR0FBRyxTQUFTLG9DQUFvQyxFQUFHLFFBQU87QUFDOUQsY0FBSSxHQUFHLFNBQVMsNkJBQTZCLEVBQUksUUFBTztBQUFBLFFBQzFEO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
