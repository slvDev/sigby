/**
 * Injected Ethereum Provider
 * Implements EIP-1193 provider interface (window.ethereum)
 * Runs in page context and communicates with content script via postMessage
 */

// Extend Window interface for TypeScript (this gets stripped in build)
interface EthereumProvider {
  isPorto: boolean;
  isMetaMask: boolean;
  request(args: { method: string; params?: any[] }): Promise<any>;
  on(event: string, handler: (...args: any[]) => void): void;
  removeListener(event: string, handler: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
}

interface Window {
  ethereum?: EthereumProvider;
}

/**
 * Porto Provider implementation
 * Provides window.ethereum interface for dApps
 */
class PortoProvider implements EthereumProvider {
  // Provider identification
  readonly isPorto = true;
  readonly isMetaMask = true; // Compatibility flag for dApps that check for MetaMask

  // Event listeners storage
  private eventListeners = new Map<string, Set<Function>>();

  // Request tracking
  private requestId = 0;
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason: any) => void;
      timeout: NodeJS.Timeout;
    }
  >();

  constructor() {
    console.log("[PortoProvider] Initializing Porto Ethereum provider");

    // Set up communication with content script
    this.setupMessageBridge();

    // Announce provider availability
    this.announceProvider();
  }

  /**
   * EIP-1193 request method
   * Main entry point for dApp interactions
   */
  async request(args: { method: string; params?: any[] }): Promise<any> {
    console.log("[PortoProvider] Request:", args.method);

    const requestId = `req_${++this.requestId}_${Date.now()}`;

    return new Promise((resolve, reject) => {
      // Set up timeout (30 seconds)
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error("Request timeout"));
      }, 30000);

      // Store pending request
      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      // Send request to content script via postMessage (use specific origin for security)
      window.postMessage(
        {
          type: "PORTO_REQUEST",
          requestId,
          method: args.method,
          params: args.params || [],
        },
        window.location.origin
      );
    });
  }

  /**
   * Add event listener (EIP-1193)
   */
  on(event: string, handler: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
  }

  /**
   * Remove event listener (EIP-1193)
   */
  removeListener(event: string, handler: (...args: any[]) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(handler);
    }
  }

  /**
   * Emit event to listeners
   */
  emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((handler) => {
        try {
          handler(...args);
        } catch (error) {
          console.error("[PortoProvider] Event handler error:", error);
        }
      });
    }
  }

  /**
   * Set up message bridge with content script
   */
  private setupMessageBridge(): void {
    window.addEventListener("message", (event: MessageEvent) => {
      // Only accept messages from same window
      if (event.source !== window) {
        return;
      }

      // Validate message origin for defense-in-depth
      if (event.origin !== window.location.origin) {
        return;
      }

      // Handle responses from content script
      if (event.data.type === "PORTO_RESPONSE") {
        this.handleResponse(event.data);
      }

      // Handle events from content script
      if (event.data.type === "PORTO_EVENT") {
        this.handleEvent(event.data);
      }
    });
  }

  /**
   * Handle response from content script
   */
  private handleResponse(data: any): void {
    const { requestId, result, error } = data;

    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(requestId);

      if (error) {
        pending.reject(new Error(error));
      } else {
        pending.resolve(result);
      }
    }
  }

  /**
   * Handle event from content script
   */
  private handleEvent(data: any): void {
    const { event, data: eventData } = data;

    console.log("[PortoProvider] Emitting event:", event, eventData);

    // Emit to all listeners
    this.emit(event, eventData);
  }

  /**
   * Announce provider via EIP-6963
   * Allows dApps to discover multiple wallet providers
   */
  private announceProvider(): void {
    const info = {
      uuid: "550e8400-e29b-41d4-a716-446655440000", // Porto wallet UUID
      name: "Porto Wallet",
      icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM2MzY2RjEiLz4KPHBhdGggZD0iTTE2IDhDMTEuNTggOCA4IDExLjU4IDggMTZDOCAyMC40MiAxMS41OCAyNCAxNiAyNEMyMC40MiAyNCAyNCwyMC40MiAyNCAxNkMyNCAxMS41OCAyMC40MiA4IDE2IDhaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4=",
      rdns: "sh.porto.wallet",
    };

    const announce = () => {
      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", {
          detail: Object.freeze({ info, provider: this }),
        })
      );
    };

    // Announce immediately
    announce();

    // Listen for discovery requests from dApps
    window.addEventListener("eip6963:requestProvider", announce);

    // Re-announce on DOMContentLoaded in case dApps check then
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", announce);
    } else {
      // DOM already loaded, announce again
      announce();
    }

    // Re-announce on window load for late-initializing dApps
    window.addEventListener("load", announce);
  }
}

// Initialize and inject provider
(function () {
  try {
    console.log("[PortoProvider] Injecting provider into window");

    // Create provider instance
    const provider = new PortoProvider();

    // Inject as window.ethereum if not already present
    if (!window.ethereum) {
      (window as any).ethereum = provider;
      console.log("[PortoProvider] Set as window.ethereum");
    } else {
      console.log("[PortoProvider] window.ethereum already exists, registering as additional provider");

      // Register in providers array (multi-wallet pattern used by some dApps)
      const existingEthereum = (window as any).ethereum;

      // Initialize providers array if needed
      if (!existingEthereum.providers) {
        existingEthereum.providers = [existingEthereum];
      }

      // Add our provider to the array
      if (!existingEthereum.providers.includes(provider)) {
        existingEthereum.providers.push(provider);
        console.log("[PortoProvider] Added to providers array");
      }
    }

    // Dispatch initialization event
    window.dispatchEvent(new Event("ethereum#initialized"));

    console.log("[PortoProvider] Provider injection complete");
  } catch (error) {
    console.error("[PortoProvider] Failed to inject provider:", error);
  }
})();
