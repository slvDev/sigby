/**
 * Vite Configuration for Chrome Extension
 * Builds multiple entry points for background, content, injected, and popup scripts
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { copyFileSync, mkdirSync, cpSync, readFileSync, writeFileSync } from "fs";

export default defineConfig({
  // Use relative paths for assets (required for Chrome extensions)
  base: "./",

  plugins: [
    react(),
    {
      name: "copy-assets",
      closeBundle() {
        try {
          // Ensure dist directory exists
          mkdirSync("dist", { recursive: true });
          mkdirSync("dist/icons", { recursive: true });

          // Copy manifest.json
          copyFileSync("public/manifest.json", "dist/manifest.json");
          console.log("✓ Copied manifest.json");

          // Copy offscreen.html
          copyFileSync("public/html/offscreen.html", "dist/offscreen.html");
          console.log("✓ Copied offscreen.html");

          // Move popup.html to root of dist and fix asset paths
          try {
            let popupHtml = readFileSync("dist/public/html/popup.html", "utf-8");

            // Fix paths to be relative from dist root
            popupHtml = popupHtml.replace(/src=".*?popup\.js"/, 'src="./popup.js"');
            popupHtml = popupHtml.replace(/href=".*?(assets\/.*?\.css)"/, 'href="./$1"');

            writeFileSync("dist/popup.html", popupHtml);
            console.log("✓ Moved popup.html to dist root with fixed paths");
          } catch (e) {
            console.error("Failed to process popup.html:", e);
          }

          // Copy icons
          cpSync("public/icons", "dist/icons", { recursive: true });
          console.log("✓ Copied icons");
        } catch (error) {
          console.error("Failed to copy assets:", error);
        }
      },
    },
  ],

  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV === "development",
    rollupOptions: {
      input: {
        // Background service worker
        background: resolve(__dirname, "src/background/index.ts"),

        // Content script
        content: resolve(__dirname, "src/content/index.ts"),

        // Injected provider (runs in page context)
        injected: resolve(__dirname, "src/injected/provider.ts"),

        // Offscreen document for WebAuthn
        offscreen: resolve(__dirname, "src/offscreen/webauthn.ts"),

        // Popup
        popup: resolve(__dirname, "public/html/popup.html"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Special handling for different script types
          if (chunkInfo.name === "popup") {
            return "popup.js";
          }
          return `${chunkInfo.name}.js`;
        },
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          // Handle different asset types
          if (assetInfo.name === "popup.html") {
            return "popup.html";
          }
          if (assetInfo.name === "offscreen.html") {
            return "offscreen.html";
          }
          if (assetInfo.name?.endsWith(".css")) {
            return "assets/[name]-[hash][extname]";
          }
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },

  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },

  // Optimize deps for extension context
  optimizeDeps: {
    include: ["react", "react-dom", "zustand"],
  },
});
