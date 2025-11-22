/**
 * Provider Injection
 * Injects the Ethereum provider script into the page context
 * Must run before any dApp code to ensure window.ethereum is available
 */

/**
 * Inject provider script into page DOM
 * Creates and injects a script tag that will run in page context
 */
export function injectProvider(): void {
  try {
    console.log("[ProviderInjection] Injecting provider into page...");

    // Create script element
    const script = document.createElement("script");

    // Get injected script URL from extension
    script.src = chrome.runtime.getURL("injected.js");

    // Set script attributes
    script.type = "text/javascript";

    // Remove script tag after execution to clean up DOM
    script.onload = function (this: HTMLScriptElement) {
      this.remove();
      console.log("[ProviderInjection] Provider script injected and cleaned up");
    };

    // Handle injection errors
    script.onerror = function (this: HTMLScriptElement) {
      console.error("[ProviderInjection] Failed to inject provider script");
      this.remove();
    };

    // Inject into page as early as possible
    // Prefer document.head, fallback to documentElement
    const target = document.head || document.documentElement;

    if (target) {
      target.appendChild(script);
      console.log("[ProviderInjection] Provider script tag added to DOM");
    } else {
      console.error(
        "[ProviderInjection] No injection target found (head or documentElement)"
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
