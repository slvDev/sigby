/**
 * Vite config for building injected script separately
 * Outputs as IIFE for page context injection
 */

import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false, // Don't clear dist, we're adding to it
    lib: {
      entry: resolve(__dirname, "src/injected/provider.ts"),
      name: "PortoProvider",
      formats: ["iife"],
      fileName: () => "injected.js",
    },
    rollupOptions: {
      output: {
        // Ensure it's a single file with no imports
        inlineDynamicImports: true,
      },
    },
  },
});
