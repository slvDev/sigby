/**
 * dApp Manager
 * Manages dApp connections, signing requests, and approval flows per account
 */

import { StorageManager, type PersistedSigningRequest } from "../utils/storage";
import type { ConnectedDapp } from "../types/account";
import type { SigningRequest, PollSigningRequestResponse } from "../types/messages";
import { CHAIN_CONFIGS, DEFAULT_CHAIN_ID, STORAGE_KEYS } from "../utils/constants";
import { RPC_ERROR_CODES } from "../utils/rpcError";
import { eventBroadcaster } from "./eventBroadcaster";

/**
 * Pending connection request
 */
interface PendingConnectionRequest {
  origin: string;
  accountAddress: string;
  favicon?: string;
  title?: string;
  resolve: (approved: boolean) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

/**
 * Pending signing request (transaction or message signing)
 */
interface PendingSigningRequest {
  request: SigningRequest;
  resolve: (result: string) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Window request tracking info
 */
interface WindowRequestInfo {
  type: "connection" | "signing";
  id: string; // requestKey for connection, requestId for signing
}

/**
 * DappManager class
 * Handles dApp connection lifecycle and approval flows
 */
export class DappManager {
  private pendingRequests: Map<string, PendingConnectionRequest> = new Map();
  private pendingSigningRequests: Map<string, PendingSigningRequest> = new Map();
  private requestTimeout = 120000; // 2 minutes timeout for connection requests
  private signingRequestTimeout = 300000; // 5 minutes timeout for signing requests

  // Window lifecycle tracking
  private windowToRequest: Map<number, WindowRequestInfo> = new Map();

  // Signing request deduplication
  // Key: `${method}:${origin}:${paramsHash}`, Value: requestId
  private signingDedupeKeys: Map<string, string> = new Map();

  // Connection request timeout tracking
  private connectionTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(private storageManager: StorageManager) {
    console.log("[DappManager] Initialized");
  }

  /**
   * Check if a dApp is connected to an account
   * @param origin - dApp origin
   * @param accountAddress - Account address
   * @returns true if connected
   */
  async isConnected(origin: string, accountAddress: string): Promise<boolean> {
    return await this.storageManager.isAccountConnectedToDapp(accountAddress, origin);
  }

  /**
   * Get all connected dApps for an account
   * @param accountAddress - Account address
   * @returns Record of origin -> ConnectedDapp
   */
  async getConnectedDapps(accountAddress: string): Promise<Record<string, ConnectedDapp>> {
    return await this.storageManager.getAccountDapps(accountAddress);
  }

  /**
   * Request connection approval from user
   * Opens popup with connection request UI
   * @param origin - dApp origin
   * @param accountAddress - Account address to connect
   * @param metadata - Optional metadata (favicon, title)
   * @returns Promise resolving to true if approved, false if rejected
   */
  async requestConnection(
    origin: string,
    accountAddress: string,
    metadata?: { favicon?: string; title?: string }
  ): Promise<boolean> {
    // Check if already connected
    const isAlreadyConnected = await this.isConnected(origin, accountAddress);
    if (isAlreadyConnected) {
      console.log("[DappManager] Already connected:", origin, accountAddress);
      return true;
    }

    // Check if there's already a pending request for this origin
    const requestKey = `${origin}:${accountAddress}`;
    if (this.pendingRequests.has(requestKey)) {
      console.log("[DappManager] Request already pending for:", requestKey);
      throw new Error("Connection request already pending");
    }

    console.log("[DappManager] Requesting connection approval for:", origin);

    // Create pending request
    return new Promise((resolve, reject) => {
      const request: PendingConnectionRequest = {
        origin,
        accountAddress,
        favicon: metadata?.favicon,
        title: metadata?.title,
        resolve,
        reject,
        timestamp: Date.now(),
      };

      this.pendingRequests.set(requestKey, request);

      // Set timeout with proper cleanup tracking
      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(requestKey)) {
          this.pendingRequests.delete(requestKey);
          this.connectionTimeouts.delete(requestKey);
          reject(new Error("Connection request timed out"));
        }
      }, this.requestTimeout);

      this.connectionTimeouts.set(requestKey, timeout);

      // Open popup with connection request
      this.openConnectionPopup(origin, accountAddress, metadata);
    });
  }

  /**
   * Approve a pending connection request
   * @param origin - dApp origin
   * @param accountAddress - Account address
   */
  async approveConnection(origin: string, accountAddress: string): Promise<void> {
    const requestKey = `${origin}:${accountAddress}`;
    const request = this.pendingRequests.get(requestKey);

    if (!request) {
      console.warn("[DappManager] No pending request found for:", requestKey);
      // Still save the connection even if no pending request
    }

    // Save connection
    await this.storageManager.connectAccountToDapp(accountAddress, origin, {
      origin,
      connected: true,
      permissions: ["eth_accounts"],
      timestamp: Date.now(),
      accountAddress,
      metadata: {
        name: request?.title,
        icon: request?.favicon,
      },
    });

    console.log("[DappManager] Connection approved:", origin, accountAddress);

    // Cleanup timeout
    const timeout = this.connectionTimeouts.get(requestKey);
    if (timeout) {
      clearTimeout(timeout);
      this.connectionTimeouts.delete(requestKey);
    }

    // Resolve pending request
    if (request) {
      this.pendingRequests.delete(requestKey);
      request.resolve(true);
    }
  }

  /**
   * Reject a pending connection request
   * @param origin - dApp origin
   * @param accountAddress - Account address
   */
  rejectConnection(origin: string, accountAddress: string): void {
    const requestKey = `${origin}:${accountAddress}`;
    const request = this.pendingRequests.get(requestKey);

    // Cleanup timeout
    const timeout = this.connectionTimeouts.get(requestKey);
    if (timeout) {
      clearTimeout(timeout);
      this.connectionTimeouts.delete(requestKey);
    }

    if (request) {
      console.log("[DappManager] Connection rejected:", origin, accountAddress);
      this.pendingRequests.delete(requestKey);
      request.resolve(false);
    }
  }

  /**
   * Disconnect a dApp from an account
   * @param origin - dApp origin
   * @param accountAddress - Account address
   */
  async disconnect(origin: string, accountAddress: string): Promise<void> {
    await this.storageManager.disconnectAccountFromDapp(accountAddress, origin);

    // Notify the dApp its access was revoked (EIP-1193 §5.1).
    await eventBroadcaster.accountsChangedForOrigin([], origin);
    await eventBroadcaster.disconnectForOrigin(origin, {
      code: 4900,
      message: "Wallet disconnected by user",
    });

    console.log("[DappManager] Disconnected:", origin, accountAddress);
  }

  /**
   * Disconnect all dApps from an account
   * @param accountAddress - Account address
   */
  async disconnectAll(accountAddress: string): Promise<void> {
    const dapps = await this.getConnectedDapps(accountAddress);
    for (const origin of Object.keys(dapps)) {
      await this.disconnect(origin, accountAddress);
    }
    console.log("[DappManager] Disconnected all dApps from:", accountAddress);
  }

  /**
   * Get pending connection request
   * @param origin - dApp origin
   * @param accountAddress - Account address
   * @returns Pending request or undefined
   */
  getPendingRequest(origin: string, accountAddress: string): PendingConnectionRequest | undefined {
    const requestKey = `${origin}:${accountAddress}`;
    return this.pendingRequests.get(requestKey);
  }

  /**
   * Get all pending requests
   * @returns Array of pending requests
   */
  getAllPendingRequests(): PendingConnectionRequest[] {
    return Array.from(this.pendingRequests.values());
  }

  // ==================== PER-ORIGIN CHAIN CONTEXT ====================

  /**
   * Get chainId for a specific origin
   * Falls back to settings.defaultChain if not set
   * @param origin - dApp origin
   * @param accountAddress - Account address
   * @returns Chain ID for this origin
   */
  async getChainIdForOrigin(origin: string, accountAddress: string): Promise<number> {
    const dapps = await this.storageManager.getAccountDapps(accountAddress);
    const normalizedOrigin = this.normalizeOrigin(origin);

    const dapp = dapps[normalizedOrigin];
    if (dapp?.chainId !== undefined) {
      return dapp.chainId;
    }

    // Fall back to settings default chain
    const settings = await this.storageManager.getSettings();
    return settings?.defaultChain ?? DEFAULT_CHAIN_ID;
  }

  /**
   * Set chainId for a specific origin
   * Validates chain is supported before setting
   * @param origin - dApp origin
   * @param accountAddress - Account address
   * @param chainId - Chain ID to set
   */
  async setChainIdForOrigin(
    origin: string,
    accountAddress: string,
    chainId: number
  ): Promise<void> {
    // Validate chain is supported
    if (!CHAIN_CONFIGS[chainId]) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    const dapps = await this.storageManager.getAccountDapps(accountAddress);
    const normalizedOrigin = this.normalizeOrigin(origin);

    if (dapps[normalizedOrigin]) {
      dapps[normalizedOrigin].chainId = chainId;
      await this.storageManager.setAccountDapps(accountAddress, dapps);
      console.log("[DappManager] Set chainId for origin:", normalizedOrigin, "->", chainId);
    } else {
      console.warn("[DappManager] Cannot set chainId - dApp not connected:", normalizedOrigin);
    }
  }

  /**
   * Get all unique chainIds currently in use by connected dApps
   * @param accountAddress - Account address
   * @returns Array of unique chain IDs
   */
  async getActiveChains(accountAddress: string): Promise<number[]> {
    const dapps = await this.storageManager.getAccountDapps(accountAddress);
    const chains = new Set<number>();

    // Collect all chainIds from connected dApps
    Object.values(dapps).forEach(dapp => {
      if (dapp.chainId !== undefined) {
        chains.add(dapp.chainId);
      }
    });

    // Always include the default chain
    const settings = await this.storageManager.getSettings();
    chains.add(settings?.defaultChain ?? DEFAULT_CHAIN_ID);

    return Array.from(chains);
  }

  /**
   * Normalize origin string for consistent key lookup
   * @param origin - Origin string (e.g., https://example.com/)
   * @returns Normalized origin
   */
  private normalizeOrigin(origin: string): string {
    try {
      const url = new URL(origin);
      return url.origin;
    } catch {
      return origin.toLowerCase().replace(/\/$/, "");
    }
  }

  /**
   * Open popup with connection approval UI
   * @param origin - dApp origin
   * @param accountAddress - Account address
   * @param metadata - Optional metadata
   */
  private openConnectionPopup(
    origin: string,
    accountAddress: string,
    metadata?: { favicon?: string; title?: string }
  ): void {
    try {
      // Build popup URL with query parameters
      const params = new URLSearchParams({
        view: "connect",
        origin: origin,
        account: accountAddress,
      });

      if (metadata?.favicon) {
        params.set("favicon", metadata.favicon);
      }
      if (metadata?.title) {
        params.set("title", metadata.title);
      }

      const requestKey = `${origin}:${accountAddress}`;

      // Open popup and capture window ID
      chrome.windows.create({
        url: `src/popup/popup.html?${params.toString()}`,
        type: "popup",
        width: 400,
        height: 600,
        focused: true,
      }, (window) => {
        if (window?.id) {
          this.windowToRequest.set(window.id, {
            type: "connection",
            id: requestKey,
          });
          console.log("[DappManager] Opened connection popup for:", origin, "windowId:", window.id);
        } else {
          console.log("[DappManager] Opened connection popup for:", origin);
        }
      });
    } catch (error) {
      console.error("[DappManager] Failed to open popup:", error);
    }
  }

  // ==================== SIGNING REQUEST MANAGEMENT ====================

  /**
   * Request signing approval from user
   * Opens popup with signing request UI
   * @param params - Signing request parameters
   * @returns Promise resolving to signed result (tx hash or signature)
   */
  async requestSigning(params: {
    method: string;
    params: any[];
    origin: string;
    accountAddress: string;
    chainId: number;
    metadata?: { favicon?: string; title?: string };
  }): Promise<string> {
    // Generate deduplication key
    const dedupeKey = this.generateDedupeKey(params.method, params.origin, params.params);

    // Check for duplicate request
    const existingRequestId = this.signingDedupeKeys.get(dedupeKey);
    if (existingRequestId && this.pendingSigningRequests.has(existingRequestId)) {
      console.log("[DappManager] Duplicate signing request detected, returning existing:", existingRequestId);
      // Return the existing promise by creating a new one that resolves when the original does
      return new Promise((resolve, reject) => {
        const existing = this.pendingSigningRequests.get(existingRequestId);
        if (existing) {
          // Chain onto the existing request
          const originalResolve = existing.resolve;
          const originalReject = existing.reject;
          existing.resolve = (result: string) => {
            originalResolve(result);
            resolve(result);
          };
          existing.reject = (error: Error) => {
            originalReject(error);
            reject(error);
          };
        } else {
          reject(new Error("Request not found"));
        }
      });
    }

    const requestId = this.generateRequestId();

    console.log("[DappManager] Requesting signing approval:", params.method, "from", params.origin);

    return new Promise((resolve, reject) => {
      const request: SigningRequest = {
        requestId,
        method: params.method,
        params: params.params,
        origin: params.origin,
        accountAddress: params.accountAddress,
        chainId: params.chainId,
        timestamp: Date.now(),
        metadata: params.metadata,
      };

      // Set timeout
      const timeout = setTimeout(() => {
        if (this.pendingSigningRequests.has(requestId)) {
          this.pendingSigningRequests.delete(requestId);
          this.signingDedupeKeys.delete(dedupeKey);
          reject(new Error("Signing request timed out"));
        }
      }, this.signingRequestTimeout);

      // Store pending request and dedupe key
      this.pendingSigningRequests.set(requestId, {
        request,
        resolve,
        reject,
        timeout,
      });
      this.signingDedupeKeys.set(dedupeKey, requestId);

      // Persist to storage BEFORE opening the popup so that if the service
      // worker is terminated mid-flow, the popup and the content-script
      // recovery poll can both still find the request.
      this.persistSigningRequest({
        request,
        state: "pending",
        createdAt: Date.now(),
      }).catch((err) => {
        console.error("[DappManager] Failed to persist signing request:", err);
      });

      // Open popup with signing request
      this.openSigningPopup(request);
    });
  }

  /**
   * Write a single persisted entry to chrome.storage.local.
   */
  private async persistSigningRequest(entry: PersistedSigningRequest): Promise<void> {
    const all = (await this.storageManager.get(STORAGE_KEYS.PENDING_SIGNING_REQUESTS)) ?? {};
    all[entry.request.requestId] = entry;
    await this.storageManager.set(STORAGE_KEYS.PENDING_SIGNING_REQUESTS, all);
  }

  /**
   * Remove a persisted entry.
   */
  private async removePersistedSigningRequest(requestId: string): Promise<void> {
    const all = (await this.storageManager.get(STORAGE_KEYS.PENDING_SIGNING_REQUESTS)) ?? {};
    if (requestId in all) {
      delete all[requestId];
      await this.storageManager.set(STORAGE_KEYS.PENDING_SIGNING_REQUESTS, all);
    }
  }

  /**
   * Mark a persisted entry as settled. We keep the row around briefly so that
   * a late-polling content script can still observe the terminal state, then
   * drop it so storage doesn't grow unbounded.
   *
   * Only transitions from `pending` — once a request has been approved or
   * rejected we must not overwrite the terminal state (e.g. a window-close
   * fired after approveSigning already settled the row).
   */
  private async settlePersistedSigningRequest(
    requestId: string,
    patch: Partial<PersistedSigningRequest>
  ): Promise<void> {
    const all = (await this.storageManager.get(STORAGE_KEYS.PENDING_SIGNING_REQUESTS)) ?? {};
    const current = all[requestId];
    if (!current || current.state !== "pending") return;
    all[requestId] = { ...current, ...patch, settledAt: Date.now() };
    await this.storageManager.set(STORAGE_KEYS.PENDING_SIGNING_REQUESTS, all);
    // Remove after a grace period so late pollers can still read the result.
    setTimeout(() => {
      this.removePersistedSigningRequest(requestId).catch(() => {});
    }, 30_000);
  }

  /**
   * List persisted signing requests currently in `pending` state.
   * Used by the toolbar popup to render the "resume pending approval" queue.
   */
  async getPersistedPendingRequests(): Promise<PersistedSigningRequest[]> {
    const all = (await this.storageManager.get(STORAGE_KEYS.PENDING_SIGNING_REQUESTS)) ?? {};
    return Object.values(all).filter((e) => e.state === "pending");
  }

  /**
   * Reopen the approval popup for a previously-dismissed pending request.
   * If the original window is still open we focus it; otherwise a fresh
   * popup is spawned and re-bound to the existing requestId.
   */
  async resumePendingRequest(requestId: string): Promise<boolean> {
    // Focus existing window if we still have it tracked.
    for (const [windowId, info] of this.windowToRequest.entries()) {
      if (info.type === "signing" && info.id === requestId) {
        try {
          await chrome.windows.update(windowId, { focused: true });
          return true;
        } catch {
          // Window may have been closed since we tracked it; fall through.
          this.windowToRequest.delete(windowId);
        }
      }
    }

    const request = await this.getPendingSigningRequest(requestId);
    if (!request) return false;
    this.openSigningPopup(request);
    return true;
  }

  /**
   * Generate deduplication key for signing requests
   */
  private generateDedupeKey(method: string, origin: string, params: any[]): string {
    // Create a simple hash of the params
    const paramsStr = JSON.stringify(params);
    let hash = 0;
    for (let i = 0; i < paramsStr.length; i++) {
      const char = paramsStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `${method}:${origin}:${hash}`;
  }

  /**
   * Get a pending signing request by ID.
   * Falls through to chrome.storage.local so the popup can still find the
   * request even if the service worker restarted since the popup was opened.
   * @param requestId - Request ID
   */
  async getPendingSigningRequest(requestId: string): Promise<SigningRequest | undefined> {
    const inMemory = this.pendingSigningRequests.get(requestId)?.request;
    if (inMemory) return inMemory;

    const all = (await this.storageManager.get(STORAGE_KEYS.PENDING_SIGNING_REQUESTS)) ?? {};
    const persisted = all[requestId];
    if (persisted && persisted.state === "pending") return persisted.request;
    return undefined;
  }

  /**
   * Poll the current state of a signing request. Used by the content script
   * to recover after `chrome.runtime.sendMessage` drops mid-request (SW death).
   */
  async pollSigningRequest(requestId: string): Promise<PollSigningRequestResponse> {
    const all = (await this.storageManager.get(STORAGE_KEYS.PENDING_SIGNING_REQUESTS)) ?? {};
    const entry = all[requestId];
    if (!entry) return { state: "not-found" };
    if (entry.state === "approved") return { state: "approved", result: entry.result };
    if (entry.state === "rejected") return { state: "rejected", error: entry.error };
    return { state: "pending" };
  }

  /**
   * Get all pending signing requests
   * @returns Array of SigningRequests
   */
  getAllPendingSigningRequests(): SigningRequest[] {
    return Array.from(this.pendingSigningRequests.values()).map(p => p.request);
  }

  /**
   * Approve a pending signing request.
   * Always writes the terminal state to storage so content-script pollers
   * (post-SW-restart) can still observe the result.
   */
  async approveSigning(requestId: string, result: string): Promise<void> {
    const pending = this.pendingSigningRequests.get(requestId);

    if (pending) {
      console.log("[DappManager] Signing approved:", requestId);
      clearTimeout(pending.timeout);
      this.pendingSigningRequests.delete(requestId);
      this.cleanupDedupeKey(requestId);
      pending.resolve(result);
    } else {
      console.warn("[DappManager] No in-memory pending request for:", requestId, "(may be a cold-start approval)");
    }

    await this.settlePersistedSigningRequest(requestId, { state: "approved", result });
  }

  /**
   * Clean up dedupe key for a request ID
   */
  private cleanupDedupeKey(requestId: string): void {
    for (const [key, value] of this.signingDedupeKeys.entries()) {
      if (value === requestId) {
        this.signingDedupeKeys.delete(key);
        break;
      }
    }
  }

  /**
   * Reject a pending signing request.
   * @param reason Optional structured error; defaults to user-reject (4001).
   */
  async rejectSigning(
    requestId: string,
    reason: { code: number; message: string } = {
      code: RPC_ERROR_CODES.USER_REJECTED,
      message: "User rejected the signing request",
    }
  ): Promise<void> {
    const pending = this.pendingSigningRequests.get(requestId);

    if (pending) {
      console.log("[DappManager] Signing rejected:", requestId, reason.code);
      clearTimeout(pending.timeout);
      this.pendingSigningRequests.delete(requestId);
      this.cleanupDedupeKey(requestId);
      pending.reject(new Error(reason.message));
    }

    await this.settlePersistedSigningRequest(requestId, { state: "rejected", error: reason });
  }

  /**
   * Cold-start sweep: mark stored pending requests older than the signing
   * window as rejected with `disconnected`. Called from the background
   * entrypoint on onStartup / onInstalled so dApp promises don't hang
   * forever after a browser restart or extension update.
   *
   * Threshold MUST be >= signingRequestTimeout — using a shorter threshold
   * races the user: the SW can idle out while the popup is still open, a
   * cold-start sweep flips the row to `rejected`, the subsequent Approve
   * then silently no-ops against the state-guarded updater in
   * `settlePersistedSigningRequest`.
   */
  async sweepOrphanSigningRequests(): Promise<void> {
    const all = (await this.storageManager.get(STORAGE_KEYS.PENDING_SIGNING_REQUESTS)) ?? {};
    const now = Date.now();
    const STALE_MS = this.signingRequestTimeout;
    const SETTLED_GRACE_MS = 30_000;
    let touched = false;
    for (const [id, entry] of Object.entries(all)) {
      if (entry.state === "pending") {
        if (now - entry.createdAt < STALE_MS) continue;
        console.log("[DappManager] Sweeping orphan signing request:", id);
        all[id] = {
          ...entry,
          state: "rejected",
          error: {
            code: RPC_ERROR_CODES.DISCONNECTED,
            message: "Wallet background restarted; please retry.",
          },
          settledAt: now,
        };
        touched = true;
      } else if (entry.settledAt && now - entry.settledAt >= SETTLED_GRACE_MS) {
        // Backstop for the 30s setTimeout in settlePersistedSigningRequest —
        // that timer dies if the SW idles out before firing, leaving terminal
        // rows in storage indefinitely.
        delete all[id];
        touched = true;
      }
    }
    if (touched) {
      await this.storageManager.set(STORAGE_KEYS.PENDING_SIGNING_REQUESTS, all);
    }
  }

  /**
   * Open popup with signing approval UI
   * @param request - Signing request
   */
  private openSigningPopup(request: SigningRequest): void {
    try {
      // Route to the right approval view by method:
      //   eth_sendTransaction / wallet_sendCalls  -> transaction preview
      //   wallet_grantPermissions                  -> session-key grant
      //   personal_sign / eth_signTypedData_*      -> plain signing
      const view =
        request.method === "eth_sendTransaction" || request.method === "wallet_sendCalls"
          ? "transaction"
          : request.method === "wallet_grantPermissions"
            ? "grant-permissions"
            : "sign";

      // Build popup URL with query parameters
      const params = new URLSearchParams({
        view,
        requestId: request.requestId,
      });

      // Open popup and capture window ID
      chrome.windows.create({
        url: `src/popup/popup.html?${params.toString()}`,
        type: "popup",
        width: 400,
        height: 600,
        focused: true,
      }, (window) => {
        if (window?.id) {
          this.windowToRequest.set(window.id, {
            type: "signing",
            id: request.requestId,
          });
          console.log("[DappManager] Opened signing popup for:", request.method, "windowId:", window.id);
        } else {
          console.log("[DappManager] Opened signing popup for:", request.method);
        }
      });
    } catch (error) {
      console.error("[DappManager] Failed to open signing popup:", error);
      // Reject the request if popup fails to open
      void this.rejectSigning(request.requestId);
    }
  }

  /**
   * Handle window closed event
   * Cleans up any pending requests associated with the closed window
   * @param windowId - ID of the closed window
   */
  handleWindowClosed(windowId: number): void {
    const requestInfo = this.windowToRequest.get(windowId);
    if (!requestInfo) {
      return; // Not a popup we're tracking
    }

    console.log("[DappManager] Window closed:", windowId, requestInfo.type, requestInfo.id);
    this.windowToRequest.delete(windowId);

    if (requestInfo.type === "signing") {
      // Closing the approval window no longer auto-rejects the request —
      // the user may have dismissed it to resume later from the toolbar
      // popup's pending-approvals queue. The 5-min signing timeout still
      // fires if they never come back; explicit Reject still works.
    } else if (requestInfo.type === "connection") {
      // Reject the connection request
      const [origin, accountAddress] = requestInfo.id.split(":");
      if (origin && accountAddress) {
        this.rejectConnection(origin, accountAddress);
      }
    }
  }

  /**
   * Generate unique request ID. Uses crypto.randomUUID so the ID is
   * unpredictable — same rationale as the injected provider's change in
   * commit 8c9d4c4: anything that crosses a dApp / content-script boundary
   * needs a real random ID, not `Math.random`.
   */
  private generateRequestId(): string {
    return crypto.randomUUID();
  }
}

/**
 * Create DappManager instance
 */
export function createDappManager(storageManager: StorageManager): DappManager {
  return new DappManager(storageManager);
}
