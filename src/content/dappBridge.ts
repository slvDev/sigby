/**
 * dApp Bridge
 * Bridges messages between injected provider (page context) and background script (extension context)
 * Acts as the secure intermediary for dApp <-> extension communication
 */

import { MessageType } from "../types/messages";

/**
 * Check if the extension context is still valid
 * Returns false if extension was reloaded/updated and this content script is orphaned
 */
function isExtensionContextValid(): boolean {
  try {
    // chrome.runtime.id is undefined if context is invalidated
    return typeof chrome !== "undefined" &&
           typeof chrome.runtime !== "undefined" &&
           typeof chrome.runtime.id !== "undefined" &&
           chrome.runtime.id !== null;
  } catch {
    return false;
  }
}

/**
 * dApp Bridge class
 * Handles bidirectional communication between page and extension
 */
class DappBridge {
  private contextValid: boolean = true;
  private contextCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    console.log("[DappBridge] Initializing dApp bridge...");
    this.setupMessageListeners();
    this.connectToBackground();
    this.startContextMonitor();
  }

  /**
   * Start periodic context validity check
   * Emits disconnect event if context becomes invalid
   */
  private startContextMonitor(): void {
    // Check every 5 seconds if context is still valid
    this.contextCheckInterval = setInterval(() => {
      if (this.contextValid && !isExtensionContextValid()) {
        console.warn("[DappBridge] Extension context became invalid");
        this.contextValid = false;

        // Emit disconnect event to page so dApp knows wallet is disconnected
        this.emitEvent("disconnect", {
          code: 4900,
          message: "Extension was updated or reloaded. Please refresh the page.",
        });

        // Stop checking since context is dead
        if (this.contextCheckInterval) {
          clearInterval(this.contextCheckInterval);
          this.contextCheckInterval = null;
        }
      }
    }, 5000);
  }

  /**
   * Set up message listeners for page <-> extension communication
   */
  private setupMessageListeners(): void {
    // Listen to messages from injected provider (page context)
    window.addEventListener("message", async (event: MessageEvent) => {
      // Validate message source (must be same window)
      if (event.source !== window) {
        return;
      }

      // Validate message origin for defense-in-depth
      if (event.origin !== window.location.origin) {
        return;
      }

      // Only handle Porto provider requests
      if (event.data.type === "PORTO_REQUEST") {
        await this.handleProviderRequest(event.data);
      }
    });

    // Listen to messages from background script
    // Guard against context invalidation when setting up listener
    if (isExtensionContextValid()) {
      try {
        chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
          // Handle events that should be emitted to page
          if (message.type === MessageType.EMIT_EVENT) {
            console.log("[DappBridge] Received EMIT_EVENT from background:", message.event);
            this.emitEvent(message.event, message.data);
          }

          sendResponse({ success: true });
          return false;
        });
      } catch (error) {
        console.error("[DappBridge] Failed to add message listener:", error);
        this.contextValid = false;
      }
    } else {
      console.warn("[DappBridge] Extension context invalid, cannot listen for background messages");
      this.contextValid = false;
    }

    console.log("[DappBridge] Message listeners set up");
  }

  /**
   * Connect to background script via long-lived port
   * (Optional - can use sendMessage instead for simpler setup)
   */
  private connectToBackground(): void {
    try {
      // For Phase 1, we'll use chrome.runtime.sendMessage
      // In future phases, can switch to Port for persistent connection
      console.log("[DappBridge] Using sendMessage for background communication");
    } catch (error) {
      console.error("[DappBridge] Failed to connect to background:", error);
    }
  }

  /**
   * Handle request from injected provider
   * Forwards request to background script and sends response back to page
   */
  private async handleProviderRequest(data: any): Promise<void> {
    const { requestId, method, params } = data;

    try {
      console.log("[DappBridge] Forwarding request to background:", method);

      // Check if extension context is still valid before sending message
      if (!isExtensionContextValid()) {
        this.contextValid = false;
        console.error("[DappBridge] Extension context invalidated - please refresh the page");

        // Notify the page that extension needs refresh
        window.postMessage(
          {
            type: "PORTO_RESPONSE",
            requestId,
            error: "Extension was updated or reloaded. Please refresh the page to reconnect.",
          },
          window.location.origin
        );
        return;
      }

      // Forward request to background script
      const response = await chrome.runtime.sendMessage({
        type: MessageType.DAPP_REQUEST,
        payload: {
          method,
          params,
          origin: window.location.origin,
        },
        requestId,
      });

      // Handle case where response is undefined (background script not responding)
      if (response === undefined) {
        throw new Error("No response from extension. Please refresh the page.");
      }

      console.log("[DappBridge] Received response from background:", response.success);

      // Send response back to page (use specific origin for security)
      window.postMessage(
        {
          type: "PORTO_RESPONSE",
          requestId,
          result: response.data,
          error: response.error,
        },
        window.location.origin
      );
    } catch (error) {
      console.error("[DappBridge] Failed to handle provider request:", error);

      // Check if this is a context invalidation error
      const errorMessage = error instanceof Error ? error.message : "Request failed";
      const isContextError = errorMessage.includes("Extension context invalidated") ||
                             errorMessage.includes("message port closed") ||
                             errorMessage.includes("Receiving end does not exist");

      if (isContextError) {
        this.contextValid = false;
      }

      // Send error back to page (use specific origin for security)
      // Provide a user-friendly message for context errors
      window.postMessage(
        {
          type: "PORTO_RESPONSE",
          requestId,
          error: isContextError
            ? "Extension was updated or reloaded. Please refresh the page to reconnect."
            : errorMessage,
        },
        window.location.origin
      );
    }
  }

  /**
   * Emit event to injected provider
   * Used for events like accountsChanged, chainChanged, etc.
   */
  public emitEvent(event: string, data: any): void {
    console.log("[DappBridge] Emitting event to page:", event);

    // Use specific origin for security
    window.postMessage(
      {
        type: "PORTO_EVENT",
        event,
        data,
      },
      window.location.origin
    );
  }

  /**
   * Check if bridge is ready and context is valid
   */
  public isReady(): boolean {
    return this.contextValid && isExtensionContextValid();
  }
}


// Initialize bridge
const bridge = new DappBridge();

// Export for potential external access
export { bridge as dappBridge };
