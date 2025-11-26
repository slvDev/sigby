/**
 * Vite Configuration for Chrome Extension
 * Uses @crxjs/vite-plugin for proper Chrome extension building
 * Uses @tailwindcss/vite for Tailwind CSS v4 integration
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { crx } from "@crxjs/vite-plugin";
import { resolve } from "path";

// Import manifest from root
import manifest from "./manifest.json";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    crx({ manifest }),
  ],

  // Use empty base for Chrome extension compatibility (relative paths)
  base: "",

  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV === "development",
  },

  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },

  optimizeDeps: {
    include: ["react", "react-dom", "zustand"],
  },

  // Server config for development
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
});
