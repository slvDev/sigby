/**
 * dApp Bridge
 * Bridges messages between injected provider (page context) and background script (extension context)
 * Acts as the secure intermediary for dApp <-> extension communication
 */

import { MessageType } from "../types/messages";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

// EIP-1193 events we allow through to the injected provider. Anything else
// from the background (even inside an EMIT_EVENT frame) is dropped so a
// compromised internal code path can't push arbitrary events to the page.
const KNOWN_PROVIDER_EVENTS = new Set([
  "accountsChanged",
  "chainChanged",
  "connect",
  "disconnect",
  "message",
]);

/**
 * Methods whose dApp-boundary requests are persisted to chrome.storage.local
 * and can therefore be recovered via POLL_SIGNING_REQUEST after a service
 * worker restart.
 *
 * NOTE: connection approvals (eth_requestAccounts, wallet_requestPermissions
 * with eth_accounts) also open a popup but are NOT persisted today, so they
 * cannot be recovered here — SW death during a connection prompt still hangs
 * the dApp until its own timeout. wallet_switchEthereumChain /
 * wallet_addEthereumChain respond synchronously and do not open a popup, so
 * SW death is not a hang risk for them.
 */
const RECOVERABLE_METHODS = new Set([
  "eth_sendTransaction",
  "personal_sign",
  "eth_sign",
  "eth_signTypedData",
  "eth_signTypedData_v3",
  "eth_signTypedData_v4",
  "wallet_sendCalls",
]);
const isRecoverableMethod = (m: unknown): boolean =>
  typeof m === "string" && RECOVERABLE_METHODS.has(m);

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
    // Check every 30 seconds if context is still valid (less aggressive)
    this.contextCheckInterval = setInterval(() => {
      if (this.contextValid && !isExtensionContextValid()) {
        console.warn("[DappBridge] Extension context became invalid - extension was reloaded");
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
    }, 30000);
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

      const data = event.data;
      // Shape-check: plain object literal, known type tag, UUID correlation id,
      // string method, array params. Silently drop anything else.
      if (
        data === null ||
        typeof data !== "object" ||
        Array.isArray(data) ||
        Object.getPrototypeOf(data) !== Object.prototype ||
        data.type !== "PORTO_REQUEST" ||
        !isUuid(data.requestId) ||
        typeof data.method !== "string" ||
        (data.params !== undefined && !Array.isArray(data.params))
      ) {
        return;
      }

      await this.handleProviderRequest(data);
    });

    // Listen to messages from background script
    // Guard against context invalidation when setting up listener
    if (isExtensionContextValid()) {
      try {
        chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
          // Handle events that should be emitted to page. Validate shape
          // before forwarding to window.postMessage — anything malformed
          // would otherwise hit the page as an EIP-1193 event.
          if (
            message !== null &&
            typeof message === "object" &&
            message.type === MessageType.EMIT_EVENT &&
            typeof message.event === "string" &&
            KNOWN_PROVIDER_EVENTS.has(message.event)
          ) {
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
      console.log("[DappBridge] Forwarding request to background:", method, "requestId:", requestId);

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

      console.log("[DappBridge] Received response from background:", method, "requestId:", requestId, "success:", response.success, "data:", response.data, "error:", response.error);

      // Send response back to page (use specific origin for security)
      console.log("[DappBridge] Posting response to page:", requestId);
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

      const errorMessage = error instanceof Error ? error.message : "Request failed";
      const isPortClosed =
        errorMessage.includes("message port closed") ||
        errorMessage.includes("Receiving end does not exist");
      const isInvalidated = errorMessage.includes("Extension context invalidated");

      // SW died mid-request (port closed). If this is a signing/transaction
      // method, the request was persisted to storage before the popup opened
      // — poll for the terminal state rather than rejecting immediately.
      if (isPortClosed && !isInvalidated && isRecoverableMethod(method)) {
        console.log("[DappBridge] SW channel dropped, polling for", requestId);
        const recovered = await this.pollPersistedRequest(requestId);
        window.postMessage(
          {
            type: "PORTO_RESPONSE",
            requestId,
            result: recovered.result,
            error: recovered.error,
          },
          window.location.origin
        );
        return;
      }

      if (isInvalidated) {
        this.contextValid = false;
      }

      window.postMessage(
        {
          type: "PORTO_RESPONSE",
          requestId,
          error: isInvalidated
            ? "Extension was updated or reloaded. Please refresh the page to reconnect."
            : errorMessage,
        },
        window.location.origin
      );
    }
  }

  /**
   * Poll the background for a persisted signing request until it settles or
   * the 5-minute signing-timeout elapses.
   */
  private async pollPersistedRequest(
    requestId: string
  ): Promise<{ result?: unknown; error?: unknown }> {
    const deadline = Date.now() + 5 * 60 * 1000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));
      if (!isExtensionContextValid()) {
        return { error: "Extension was updated or reloaded. Please refresh the page." };
      }
      try {
        const resp = await chrome.runtime.sendMessage({
          type: MessageType.POLL_SIGNING_REQUEST,
          payload: { requestId },
        });
        if (!resp?.success) continue;
        const state = resp.data?.state;
        if (state === "approved") return { result: resp.data.result };
        if (state === "rejected") return { error: resp.data.error };
        if (state === "not-found") {
          return {
            error: { code: -32603, message: "Request lost (wallet background restarted)" },
          };
        }
        // state === "pending" — keep polling.
      } catch {
        // Port might still be flaky; try again.
      }
    }
    return { error: { code: -32603, message: "Signing request timed out" } };
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
