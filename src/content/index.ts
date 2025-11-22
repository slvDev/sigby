/**
 * Content Script Entry Point
 * Runs on every webpage and sets up provider injection and dApp communication bridge
 */

import { injectProvider, shouldInjectProvider } from "./providerInjection";
import "./dappBridge"; // Initialize dApp bridge

/**
 * Main content script initialization
 */
function initialize(): void {
  console.log("[ContentScript] Initializing on:", window.location.href);

  // Check if provider should be injected on this page
  if (!shouldInjectProvider()) {
    console.log("[ContentScript] Skipping provider injection on this page");
    return;
  }

  // Inject provider script into page context
  // This must happen as early as possible (document_start)
  injectProvider();

  // dApp bridge is auto-initialized via import
  console.log("[ContentScript] Content script initialized");
}

// Run initialization
try {
  initialize();
} catch (error) {
  console.error("[ContentScript] Failed to initialize:", error);
}
