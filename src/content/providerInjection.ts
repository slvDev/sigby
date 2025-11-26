/**
 * Provider Injection
 * Injects the Ethereum provider script into the page context
 * Must run before any dApp code to ensure window.ethereum is available
 */

/**
 * Inject provider script into page DOM
 * Creates and injects a script tag that will run in page context
 * Uses synchronous injection for earliest possible execution
 */
export function injectProvider(): void {
  try {
    console.log("[ProviderInjection] Injecting provider into page...");

    // Create script element
    const script = document.createElement("script");

    // Get injected script URL from extension
    // Built separately as IIFE for page context
    script.src = chrome.runtime.getURL("injected.js");

    // Set script attributes for earliest execution
    script.type = "text/javascript";
    script.async = false; // Execute in order

    // Remove script tag after execution to clean up DOM
    script.onload = function () {
      script.remove();
      console.log("[ProviderInjection] Provider script injected and cleaned up");
    };

    // Handle injection errors
    script.onerror = function () {
      console.error("[ProviderInjection] Failed to inject provider script");
      script.remove();
    };

    // Inject into documentElement as FIRST child for earliest execution
    // This runs before head is even created in most cases
    const target = document.documentElement;

    if (target) {
      // Prepend to ensure it runs before other scripts
      target.insertBefore(script, target.firstChild);
      console.log("[ProviderInjection] Provider script tag prepended to documentElement");
    } else {
      console.error(
        "[ProviderInjection] No injection target found (documentElement)"
      );
    }
  } catch (error) {
    console.error("[ProviderInjection] Failed to inject provider:", error);
  }
}

/**
 * Check if provider should be injected
 * Avoid injecting on extension pages or privileged contexts
 */
export function shouldInjectProvider(): boolean {
  // Don't inject on extension pages
  if (window.location.protocol === "chrome-extension:") {
    return false;
  }

  // Don't inject on chrome:// pages
  if (window.location.protocol === "chrome:") {
    return false;
  }

  // Don't inject on about: pages
  if (window.location.protocol === "about:") {
    return false;
  }

  // Inject on http and https pages
  return true;
}
