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
  isSigby: boolean;
  isMetaMask: boolean;
  request(args: { method: string; params?: any[] }): Promise<any>;
  on(event: string, handler: (...args: any[]) => void): unknown;
  removeListener(event: string, handler: (...args: any[]) => void): unknown;
  addListener(event: string, handler: (...args: any[]) => void): unknown;
  off(event: string, handler: (...args: any[]) => void): unknown;
  once(event: string, handler: (...args: any[]) => void): unknown;
  emit(event: string, ...args: any[]): void;
  isConnected(): boolean;
}

interface Window {
  ethereum?: EthereumProvider;
}

/**
 * Sigby Provider implementation
 * Provides window.ethereum interface for dApps
 */
class SigbyProvider implements EthereumProvider {
  // Provider identification
  readonly isSigby = true;
  // Do NOT advertise the legacy `isMetaMask: true` compatibility flag.
  // Some dApps still branch on it into provider-specific code paths
  // that assume implementation details we don't share — e.g. assuming
  // certain event ordering on reconnect, or that account-discovery
  // RPCs return cached state in specific shapes. Taking that branch
  // with our slightly-different behaviour produces half-initialised
  // connector state on the dApp side. EIP-6963 is the correct
  // discovery mechanism; dApps still gating on this flag are legacy.
  readonly isMetaMask = false;

  // State properties — synced from RPC responses + provider events
  // for sync legacy access patterns (`provider.chainId`,
  // `provider.selectedAddress`).
  public chainId: string | null = null;
  public selectedAddress: string | null = null;
  public networkVersion: string | null = null;

  // EIP-1193 specifies `isConnected()` as a METHOD returning boolean,
  // not a property. wagmi-based connectors call `provider.isConnected()`
  // — a boolean property would throw "isConnected is not a function".
  // Back the method with a private flag updated by `connect` /
  // `disconnect` events.
  private _connected: boolean = true;
  public isConnected(): boolean {
    return this._connected;
  }

  /**
   * Tracks whether we've already emitted the EIP-1193 `connect` event
   * for this page lifetime. Subsequent chain transitions use
   * `chainChanged`, not `connect` — the spec requires `connect` fire
   * only when the provider transitions from disconnected to connected.
   */
  private hasEmittedConnect: boolean = false;

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
    console.log("[Sigby] Initializing Ethereum provider");

    // EIP-6963 §Security: once the provider is announced, dApps and other
    // extensions pass a reference around. A hostile page script could try
    // `provider.request = evilFn` to hijack in-flight calls — pin the core
    // EIP-1193 surface as non-writable + non-configurable so that fails.
    // State fields (chainId, selectedAddress, …) stay mutable because the
    // provider needs to update them on events.
    const lockedMethods: Array<keyof SigbyProvider> = [
      "request",
      "on",
      "removeListener",
      "addListener",
      "off",
      "once",
      "emit",
      "isConnected",
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
    console.log("[Sigby] Request:", args.method);

    const requestId = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      // Set up timeout (2 minutes for signing requests)
      const timeout = setTimeout(() => {
        console.warn("[Sigby] Request timeout:", requestId, args.method);
        this.pendingRequests.delete(requestId);
        reject(new Error("Request timeout"));
      }, 120000);

      // Store pending request with method for state updates
      this.pendingRequests.set(requestId, { resolve, reject, timeout, method: args.method });

      // Send request to content script via postMessage (use specific origin for security)
      window.postMessage(
        {
          type: "SIGBY_REQUEST",
          requestId,
          method: args.method,
          params: args.params || [],
        },
        window.location.origin
      );
    });
  }

  /**
   * Add event listener (EIP-1193). Returns `this` so callers can
   * chain `provider.on('connect', a).on('disconnect', b)` — some
   * wallet connectors rely on that idiom.
   */
  on(event: string, handler: (...args: any[]) => void): this {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
    return this;
  }

  /**
   * Remove event listener (EIP-1193). Chainable.
   */
  removeListener(event: string, handler: (...args: any[]) => void): this {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(handler);
    }
    return this;
  }

  /**
   * EventEmitter aliases. web3.js v1 and several older wallet
   * connectors reach for these names instead of `on` /
   * `removeListener` — calling them on a provider that doesn't
   * expose them throws `… is not a function` at connect time.
   * Same failure class as the `isConnected` property-vs-method bug.
   */
  addListener(event: string, handler: (...args: any[]) => void): this {
    return this.on(event, handler);
  }

  off(event: string, handler: (...args: any[]) => void): this {
    return this.removeListener(event, handler);
  }

  once(event: string, handler: (...args: any[]) => void): this {
    const wrapper = (...args: any[]) => {
      this.removeListener(event, wrapper);
      try {
        handler(...args);
      } catch (err) {
        console.error("[Sigby] once() handler error:", err);
      }
    };
    return this.on(event, wrapper);
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
          console.error("[Sigby] Event handler error:", error);
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

      if (data.type === "SIGBY_RESPONSE") {
        if (!isUuid(data.requestId)) return;
        this.handleResponse(data);
      } else if (data.type === "SIGBY_EVENT") {
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

    console.log("[Sigby] Handling response:", requestId, "result:", result, "error:", error);

    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      console.log("[Sigby] Found pending request, resolving:", requestId);
      clearTimeout(pending.timeout);

      // Update locally-cached state for sync legacy accessors
      // (`provider.chainId`, `provider.selectedAddress`) based on the
      // RPC response we just got back.
      if (!error && result !== undefined) {
        this.updateStateFromResponse(pending.method, result);
      }

      this.pendingRequests.delete(requestId);

      if (error) {
        console.log("[Sigby] Rejecting with error:", error);
        pending.reject(errorFromResponse(error));
      } else {
        console.log("[Sigby] Resolving with result:", result);
        pending.resolve(result);
      }
    } else {
      console.warn("[Sigby] No pending request found for:", requestId);
    }
  }

  /**
   * Update locally-cached state properties from RPC responses so that
   * sync legacy accessors (`provider.chainId`, `provider.selectedAddress`,
   * `provider.networkVersion`) reflect the latest known values without
   * requiring a roundtrip on every read.
   */
  private updateStateFromResponse(method: string | undefined, result: any): void {
    switch (method) {
      case "eth_chainId":
        // Defensive shape-check: background always sends a 0x-hex
        // string, but a misconfigured future codepath could deliver
        // something else and poison cached chainId / networkVersion.
        if (typeof result === "string" && /^0x[0-9a-fA-F]+$/.test(result)) {
          this.chainId = result;
          this.networkVersion = String(parseInt(result, 16));
          console.log("[Sigby] Updated chainId:", this.chainId, "networkVersion:", this.networkVersion);

          // EIP-1193: emit `connect` with `{ chainId }` the first time
          // the provider is able to submit RPC requests to a chain.
          // Wagmi's connector state machine listens for this event to
          // transition into the `connected` state — without it, dApp
          // hooks (Uniswap's especially) stay in a half-initialized
          // state where derived selectors read undefined account fields
          // and crash. Fire once per page lifetime; subsequent chain
          // changes go through `chainChanged`, not `connect`.
          if (!this.hasEmittedConnect) {
            this.hasEmittedConnect = true;
            this._connected = true;
            this.emit("connect", { chainId: result });
          }
        }
        break;
      case "eth_accounts":
      case "eth_requestAccounts":
        // Mirror the event-handler path (case "accountsChanged") — an
        // empty result means "no account exposed" (typical when the
        // wallet locks), and selectedAddress must clear to match.
        // The previous `length > 0` guard left a stale address behind
        // when the RPC said locked but the accountsChanged event was
        // delayed or lost, leaking through `window.ethereum.selectedAddress`.
        if (Array.isArray(result)) {
          const first = result[0];
          this.selectedAddress = typeof first === "string" ? first : null;
          console.log("[Sigby] Updated selectedAddress:", this.selectedAddress);
        }
        break;
      case "net_version":
        if (typeof result === "string") {
          this.networkVersion = result;
        }
        break;
    }
  }

  /**
   * Handle event from content script
   */
  private handleEvent(data: any): void {
    const { event, data: eventData } = data;

    console.log("[Sigby] Emitting event:", event, eventData);

    // Mirror EIP-1193 event payloads into the locally-cached state
    // properties so legacy sync accessors stay in sync without a
    // request roundtrip.
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
        this._connected = true;
        if (eventData?.chainId) {
          this.chainId = eventData.chainId;
          this.networkVersion = String(parseInt(eventData.chainId, 16));
        }
        break;
      case "disconnect":
        // Clear account-scoped state so a stale selectedAddress
        // doesn't survive a disconnect (e.g. account removal or
        // origin revocation). Chain-scoped fields stay set — the
        // chain itself is public; a reconnect on the same origin
        // doesn't re-announce chainChanged.
        this._connected = false;
        this.selectedAddress = null;
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
    console.warn("[Sigby] enable() is deprecated, use request({ method: 'eth_requestAccounts' })");
    return this.request({ method: "eth_requestAccounts" });
  }

  /**
   * Legacy send() method (deprecated)
   */
  send(methodOrPayload: string | any, paramsOrCallback?: any[] | Function): any {
    console.warn("[Sigby] send() is deprecated, use request()");

    // Handle callback style: send(payload, callback)
    if (typeof paramsOrCallback === "function") {
      const callback = paramsOrCallback;
      const payload = methodOrPayload;
      this.request({ method: payload.method, params: payload.params })
        .then((result) => callback(null, { id: payload.id, jsonrpc: "2.0", result }))
        .catch((error) => callback(error, null));
      return;
    }

    // Handle sync style for specific methods. eth_accounts /
    // eth_coinbase are deliberately NOT returned from the cached
    // selectedAddress: the dApp-observable lock surface can flip
    // between reads, and the legacy sync path bypassed it entirely
    // (stale unlocked address survived lock expiry). Route them
    // through request() so the lock gate runs.
    if (typeof methodOrPayload === "string") {
      const method = methodOrPayload;
      const params = paramsOrCallback || [];

      // Chain/network info is lock-independent and cached locally.
      if (method === "net_version") {
        return { result: this.networkVersion };
      }
      if (method === "eth_chainId") {
        return { result: this.chainId };
      }

      // Everything else — including eth_accounts / eth_coinbase —
      // returns a Promise. The sync return form of `send()` was
      // deprecated by EIP-1193's predecessor and is no longer
      // supported by current-generation wallet providers; legacy
      // dApps that relied on it broke industry-wide years ago.
      return this.request({ method, params });
    }

    // Handle payload object style
    return this.request({ method: methodOrPayload.method, params: methodOrPayload.params });
  }

  /**
   * Legacy sendAsync() method (deprecated)
   */
  sendAsync(payload: any, callback: (error: any, response: any) => void): void {
    console.warn("[Sigby] sendAsync() is deprecated, use request()");
    this.request({ method: payload.method, params: payload.params })
      .then((result) => callback(null, { id: payload.id, jsonrpc: "2.0", result }))
      .catch((error) => callback(error, null));
  }

  /**
   * Legacy `_metamask` namespace — the API name is fixed by widely-
   * deployed dApp code that gates UI on `provider._metamask.isUnlocked()`.
   * The implementation is ours: queries the background's cached lock
   * state via a Sigby-private RPC method so the answer reflects the
   * popup's actual lock state, not just whether a `selectedAddress`
   * happens to be cached locally. Falls back to the address-present
   * heuristic on any RPC error so flaky background comms don't strand
   * dApps.
   */
  _metamask = {
    isUnlocked: async (): Promise<boolean> => {
      try {
        const locked = await this.request({ method: "_sigby_isLocked" });
        return !locked;
      } catch {
        return this.selectedAddress !== null;
      }
    },
  };

  /**
   * Announce provider via EIP-6963
   * Allows dApps to discover multiple wallet providers
   */
  private announceProvider(): void {
    const info = {
      uuid: "e6a4f8b2-9c3d-4a1b-8b5f-7d2c4e6a1f93", // Sigby provider UUID
      name: "Sigby",
      icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM2MzY2RjEiLz4KPHBhdGggZD0iTTE2IDhDMTEuNTggOCA4IDExLjU4IDggMTZDOCAyMC40MiAxMS41OCAyNCAxNiAyNEMyMC40MiAyNCAyNCwyMC40MiAyNCAxNkMyNCAxMS41OCAyMC40MiA4IDE2IDhaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4=",
      rdns: "com.sigbywallet",
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
    console.log("[Sigby] Injecting provider into window");

    // Create provider instance
    const provider = new SigbyProvider();

    // Inject as window.ethereum if not already present. If another wallet
    // got there first, leave its object alone — multi-wallet discovery is
    // EIP-6963's job (we already announce). Mutating another wallet's
    // `providers` array was a pre-6963 shim that can interfere with the
    // other wallet's freezing / isolation guarantees.
    if (!window.ethereum) {
      (window as any).ethereum = provider;
      console.log("[Sigby] Set as window.ethereum");
    } else {
      console.log("[Sigby] window.ethereum already exists — relying on EIP-6963 for discovery");
    }

    // Dispatch initialization event
    window.dispatchEvent(new Event("ethereum#initialized"));

    console.log("[Sigby] Provider injection complete");
  } catch (error) {
    console.error("[Sigby] Failed to inject provider:", error);
  }
})();
