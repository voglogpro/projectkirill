import { defineConfig } from "vite";

export default defineConfig({
  base: "/miniapp-assets/",
  server: { proxy: { "/v1": "http://localhost:3000" } },
  build: {
    target: "es2020",
    sourcemap: true,
    cssCodeSplit: true,
    rollupOptions: { output: { manualChunks: undefined } },
  },
});
