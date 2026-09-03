import { resolve } from "node:path";
import { defineConfig } from "vite";

// Builds the real Mini App renderer as a single IIFE for the preview shell.
export default defineConfig({
  build: {
    target: "es2020",
    outDir: resolve(import.meta.dirname, ".build"),
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: resolve(import.meta.dirname, "miniapp-entry.ts"),
      formats: ["iife"],
      name: "TmaMiniAppPreview",
      fileName: () => "miniapp-preview.js",
    },
    rollupOptions: { output: { assetFileNames: "miniapp-preview.[ext]" } },
  },
});
