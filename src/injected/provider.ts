/**
 * Injected Ethereum Provider
 * Implements EIP-1193 provider interface (window.ethereum)
 * Runs in page context and communicates with content script via postMessage
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

/**
 * EIP-1193 ProviderRpcError, inlined here because the injected script is built
 * as a standalone bundle (see vite.injected.config.ts) and we don't want to
 * pull in TS/utils barrels. Kept in sync with src/utils/rpcError.ts.
 */
class ProviderRpcError extends Error {
  readonly code: number;
  readonly data?: unknown;
  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = "ProviderRpcError";
    this.code = code;
    this.data = data;
  }
}

function errorFromResponse(err: unknown): Error {
  if (err && typeof err === "object" && typeof (err as any).code === "number" && typeof (err as any).message === "string") {
    const e = err as { code: number; message: string; data?: unknown };
    return new ProviderRpcError(e.code, e.message, e.data);
  }
  // Legacy string error — -32603 (internal) is the least-bad fallback per JSON-RPC 2.0.
  return new ProviderRpcError(-32603, typeof err === "string" ? err : "Unknown error");
}

// Extend Window interface for TypeScript (this gets stripped in build)
interface EthereumProvider {
  isBerth: boolean;
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
 * Berth Provider implementation
 * Provides window.ethereum interface for dApps
 */
class BerthProvider implements EthereumProvider {
  // Provider identification
  readonly isBerth = true;
  readonly isMetaMask = true; // Compatibility flag for dApps that check for MetaMask

  // State properties (MetaMask compatibility)
  // These are updated via events from the extension
  public chainId: string | null = null;
  public selectedAddress: string | null = null;
  public networkVersion: string | null = null;
  public isConnected: boolean = true;

  // Event listeners storage
  private eventListeners = new Map<string, Set<Function>>();

  // Request tracking
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason: any) => void;
      timeout: ReturnType<typeof setTimeout>;
      method?: string;
    }
  >();

  constructor() {
    console.log("[Berth] Initializing Ethereum provider");

    // EIP-6963 §Security: once the provider is announced, dApps and other
    // extensions pass a reference around. A hostile page script could try
    // `provider.request = evilFn` to hijack in-flight calls — pin the core
    // EIP-1193 surface as non-writable + non-configurable so that fails.
    // State fields (chainId, selectedAddress, …) stay mutable because the
    // provider needs to update them on events.
    const lockedMethods: Array<keyof BerthProvider> = [
      "request",
      "on",
      "removeListener",
      "emit",
      "enable",
      "send",
      "sendAsync",
    ];
    for (const name of lockedMethods) {
      const method = this[name];
      if (typeof method === "function") {
        Object.defineProperty(this, name, {
          value: (method as Function).bind(this),
          writable: false,
          configurable: false,
          enumerable: true,
        });
      }
    }
    // Freeze the _metamask shim so dApps can't flip isUnlocked under us.
    Object.defineProperty(this, "_metamask", {
      value: Object.freeze(this._metamask),
      writable: false,
      configurable: false,
      enumerable: true,
    });

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
    console.log("[Berth] Request:", args.method);

    const requestId = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      // Set up timeout (2 minutes for signing requests)
      const timeout = setTimeout(() => {
        console.warn("[Berth] Request timeout:", requestId, args.method);
        this.pendingRequests.delete(requestId);
        reject(new Error("Request timeout"));
      }, 120000);

      // Store pending request with method for state updates
      this.pendingRequests.set(requestId, { resolve, reject, timeout, method: args.method });

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
          console.error("[Berth] Event handler error:", error);
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

      const data = event.data;
      // Shape-check: plain object literal, no array/prototype tricks, known type tag.
      if (
        data === null ||
        typeof data !== "object" ||
        Array.isArray(data) ||
        Object.getPrototypeOf(data) !== Object.prototype
      ) {
        return;
      }

      if (data.type === "PORTO_RESPONSE") {
        if (!isUuid(data.requestId)) return;
        this.handleResponse(data);
      } else if (data.type === "PORTO_EVENT") {
        if (typeof data.event !== "string") return;
        this.handleEvent(data);
      }
    });
  }

  /**
   * Handle response from content script
   */
  private handleResponse(data: any): void {
    const { requestId, result, error } = data;

    console.log("[Berth] Handling response:", requestId, "result:", result, "error:", error);

    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      console.log("[Berth] Found pending request, resolving:", requestId);
      clearTimeout(pending.timeout);

      // Update state properties based on method (MetaMask compatibility)
      if (!error && result !== undefined) {
        this.updateStateFromResponse(pending.method, result);
      }

      this.pendingRequests.delete(requestId);

      if (error) {
        console.log("[Berth] Rejecting with error:", error);
        pending.reject(errorFromResponse(error));
      } else {
        console.log("[Berth] Resolving with result:", result);
        pending.resolve(result);
      }
    } else {
      console.warn("[Berth] No pending request found for:", requestId);
    }
  }

  /**
   * Update state properties from RPC responses (MetaMask compatibility)
   */
  private updateStateFromResponse(method: string | undefined, result: any): void {
    switch (method) {
      case "eth_chainId":
        this.chainId = result;
        // networkVersion is decimal string of chainId
        this.networkVersion = result ? String(parseInt(result, 16)) : null;
        console.log("[Berth] Updated chainId:", this.chainId, "networkVersion:", this.networkVersion);
        break;
      case "eth_accounts":
      case "eth_requestAccounts":
        if (Array.isArray(result) && result.length > 0) {
          this.selectedAddress = result[0];
          console.log("[Berth] Updated selectedAddress:", this.selectedAddress);
        }
        break;
      case "net_version":
        this.networkVersion = result;
        break;
    }
  }

  /**
   * Handle event from content script
   */
  private handleEvent(data: any): void {
    const { event, data: eventData } = data;

    console.log("[Berth] Emitting event:", event, eventData);

    // Update state properties from events (MetaMask compatibility)
    switch (event) {
      case "chainChanged":
        this.chainId = eventData;
        this.networkVersion = eventData ? String(parseInt(eventData, 16)) : null;
        break;
      case "accountsChanged":
        if (Array.isArray(eventData) && eventData.length > 0) {
          this.selectedAddress = eventData[0];
        } else {
          this.selectedAddress = null;
        }
        break;
      case "connect":
        this.isConnected = true;
        if (eventData?.chainId) {
          this.chainId = eventData.chainId;
          this.networkVersion = String(parseInt(eventData.chainId, 16));
        }
        break;
      case "disconnect":
        this.isConnected = false;
        break;
    }

    // Emit to all listeners
    this.emit(event, eventData);
  }

  // Legacy methods for backwards compatibility

  /**
   * Legacy enable() method (deprecated, use request({method: 'eth_requestAccounts'}))
   */
  async enable(): Promise<string[]> {
    console.warn("[Berth] enable() is deprecated, use request({ method: 'eth_requestAccounts' })");
    return this.request({ method: "eth_requestAccounts" });
  }

  /**
   * Legacy send() method (deprecated)
   */
  send(methodOrPayload: string | any, paramsOrCallback?: any[] | Function): any {
    console.warn("[Berth] send() is deprecated, use request()");

    // Handle callback style: send(payload, callback)
    if (typeof paramsOrCallback === "function") {
      const callback = paramsOrCallback;
      const payload = methodOrPayload;
      this.request({ method: payload.method, params: payload.params })
        .then((result) => callback(null, { id: payload.id, jsonrpc: "2.0", result }))
        .catch((error) => callback(error, null));
      return;
    }

    // Handle sync style for specific methods
    if (typeof methodOrPayload === "string") {
      const method = methodOrPayload;
      const params = paramsOrCallback || [];

      // Some methods can return sync (though deprecated)
      if (method === "eth_accounts") {
        return { result: this.selectedAddress ? [this.selectedAddress] : [] };
      }
      if (method === "eth_coinbase") {
        return { result: this.selectedAddress };
      }
      if (method === "net_version") {
        return { result: this.networkVersion };
      }
      if (method === "eth_chainId") {
        return { result: this.chainId };
      }

      // For async methods, return promise
      return this.request({ method, params });
    }

    // Handle payload object style
    return this.request({ method: methodOrPayload.method, params: methodOrPayload.params });
  }

  /**
   * Legacy sendAsync() method (deprecated)
   */
  sendAsync(payload: any, callback: (error: any, response: any) => void): void {
    console.warn("[Berth] sendAsync() is deprecated, use request()");
    this.request({ method: payload.method, params: payload.params })
      .then((result) => callback(null, { id: payload.id, jsonrpc: "2.0", result }))
      .catch((error) => callback(error, null));
  }

  /**
   * MetaMask-specific API (some dApps gate UI behind it).
   * We mirror "has an account been unlocked / selected", since Berth has no
   * lock concept of its own — passkeys live in the OS keychain. Returning
   * true unconditionally (as we used to) broke dApps that show a "Connect"
   * CTA when this is false.
   */
  _metamask = {
    isUnlocked: async (): Promise<boolean> => this.selectedAddress !== null,
  };

  /**
   * Announce provider via EIP-6963
   * Allows dApps to discover multiple wallet providers
   */
  private announceProvider(): void {
    const info = {
      uuid: "e6a4f8b2-9c3d-4a1b-8b5f-7d2c4e6a1f93", // Berth provider UUID
      name: "Berth",
      icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM2MzY2RjEiLz4KPHBhdGggZD0iTTE2IDhDMTEuNTggOCA4IDExLjU4IDggMTZDOCAyMC40MiAxMS41OCAyNCAxNiAyNEMyMC40MiAyNCAyNCwyMC40MiAyNCAxNkMyNCAxMS41OCAyMC40MiA4IDE2IDhaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4=",
      rdns: "com.berthwallet",
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
    console.log("[Berth] Injecting provider into window");

    // Create provider instance
    const provider = new BerthProvider();

    // Inject as window.ethereum if not already present. If another wallet
    // got there first, leave its object alone — multi-wallet discovery is
    // EIP-6963's job (we already announce). Mutating another wallet's
    // `providers` array was a pre-6963 shim that can interfere with the
    // other wallet's freezing / isolation guarantees.
    if (!window.ethereum) {
      (window as any).ethereum = provider;
      console.log("[Berth] Set as window.ethereum");
    } else {
      console.log("[Berth] window.ethereum already exists — relying on EIP-6963 for discovery");
    }

    // Dispatch initialization event
    window.dispatchEvent(new Event("ethereum#initialized"));

    console.log("[Berth] Provider injection complete");
  } catch (error) {
    console.error("[Berth] Failed to inject provider:", error);
  }
})();
