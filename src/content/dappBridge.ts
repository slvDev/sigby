/**
 * dApp Bridge
 * Bridges messages between injected provider (page context) and background script (extension context)
 * Acts as the secure intermediary for dApp <-> extension communication
 */

import { MessageType } from "../types/messages";

/**
 * dApp Bridge class
 * Handles bidirectional communication between page and extension
 */
class DappBridge {
  constructor() {
    console.log("[DappBridge] Initializing dApp bridge...");
    this.setupMessageListeners();
    this.connectToBackground();
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
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      // Handle events that should be emitted to page
      if (message.type === MessageType.EMIT_EVENT) {
        this.emitEvent(message.event, message.data);
      }

      sendResponse({ success: true });
      return false;
    });

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

      // Send error back to page (use specific origin for security)
      window.postMessage(
        {
          type: "PORTO_RESPONSE",
          requestId,
          error: error instanceof Error ? error.message : "Request failed",
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
   * Check if bridge is ready
   */
  public isReady(): boolean {
    return true;
  }
}

// Initialize bridge
const bridge = new DappBridge();

// Export for potential external access
export { bridge as dappBridge };
