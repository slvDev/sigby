/**
 * dApp Manager
 * Manages dApp connections and approval flows per account
 */

import { StorageManager } from "../utils/storage";
import type { ConnectedDapp } from "../types/account";

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
 * DappManager class
 * Handles dApp connection lifecycle and approval flows
 */
export class DappManager {
  private pendingRequests: Map<string, PendingConnectionRequest> = new Map();
  private requestTimeout = 120000; // 2 minutes timeout for connection requests

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

      // Set timeout
      setTimeout(() => {
        if (this.pendingRequests.has(requestKey)) {
          this.pendingRequests.delete(requestKey);
          reject(new Error("Connection request timed out"));
        }
      }, this.requestTimeout);

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

      // Open popup
      chrome.windows.create({
        url: `src/popup/popup.html?${params.toString()}`,
        type: "popup",
        width: 400,
        height: 600,
        focused: true,
      });

      console.log("[DappManager] Opened connection popup for:", origin);
    } catch (error) {
      console.error("[DappManager] Failed to open popup:", error);
    }
  }
}

/**
 * Create DappManager instance
 */
export function createDappManager(storageManager: StorageManager): DappManager {
  return new DappManager(storageManager);
}
