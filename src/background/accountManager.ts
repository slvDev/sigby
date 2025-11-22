/**
 * Account Manager
 * Manages account lifecycle, authentication state, and persistence
 */

import { StorageManager } from "../utils/storage";
import { PortoService } from "./portoService";
import type { Account } from "../types/account";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "../utils/constants";

/**
 * Account Manager class
 * Handles account creation, connection, and state management
 */
export class AccountManager {
  constructor(
    private storageManager: StorageManager,
    private portoService: PortoService
  ) {}

  /**
   * Create a new account using WebAuthn
   * @param displayName - Optional display name for the account
   * @returns Promise resolving to account address
   */
  async createNewAccount(displayName?: string): Promise<string> {
    try {
      console.log("[AccountManager] Creating new account...");

      // Create account through Porto service
      const result = await this.portoService.createAccount({ displayName });

      // Create account object
      const account: Account = {
        address: result.address,
        credentialId: result.credentialId,
        publicKey: result.publicKey,
        displayName: displayName || "Porto Wallet",
        createdAt: Date.now(),
        lastAuthAt: Date.now(),
      };

      // Save to storage
      await this.storageManager.setAccount(account);

      console.log("[AccountManager] Account created and saved:", account.address);

      return account.address;
    } catch (error) {
      console.error("[AccountManager] Failed to create account:", error);
      throw error;
    }
  }

  /**
   * Connect to existing account using WebAuthn
   * @returns Promise resolving to account address
   */
  async connectExistingAccount(): Promise<string> {
    try {
      console.log("[AccountManager] Connecting to existing account...");

      // Connect through Porto service
      const result = await this.portoService.connectAccount();

      if (!result.accounts || result.accounts.length === 0) {
        throw new Error("No accounts found");
      }

      const address = result.accounts[0];

      // Check if account already exists in storage
      const existingAccount = await this.storageManager.getAccount();

      if (existingAccount && existingAccount.address === address) {
        // Update last auth time
        existingAccount.lastAuthAt = Date.now();
        await this.storageManager.setAccount(existingAccount);
        console.log("[AccountManager] Existing account reconnected:", address);
        return address;
      }

      // Create new account entry
      const account: Account = {
        address,
        credentialId: "", // Will be populated by Porto
        publicKey: "",
        displayName: "Porto Wallet",
        createdAt: Date.now(),
        lastAuthAt: Date.now(),
      };

      await this.storageManager.setAccount(account);

      console.log("[AccountManager] New account connected and saved:", address);

      return address;
    } catch (error) {
      console.error("[AccountManager] Failed to connect account:", error);
      throw error;
    }
  }

  /**
   * Get current account
   * @returns Promise resolving to Account or null
   */
  async getAccount(): Promise<Account | null> {
    try {
      const account = await this.storageManager.getAccount();
      return account;
    } catch (error) {
      console.error("[AccountManager] Failed to get account:", error);
      return null;
    }
  }

  /**
   * Get current account address
   * @returns Promise resolving to address string or null
   */
  async getAccountAddress(): Promise<string | null> {
    const account = await this.getAccount();
    return account?.address || null;
  }

  /**
   * Check if user has an account
   * @returns Promise resolving to boolean
   */
  async hasAccount(): Promise<boolean> {
    return await this.storageManager.hasAccount();
  }

  /**
   * Check if user is authenticated (has account and session is valid)
   * @returns Promise resolving to boolean
   */
  async isAuthenticated(): Promise<boolean> {
    const account = await this.getAccount();

    if (!account) {
      return false;
    }

    // Check if last auth is recent enough
    // For Phase 1, we'll consider any account as authenticated
    // In future phases, implement session timeout logic
    return true;
  }

  /**
   * Disconnect current account (logout)
   * Removes account from storage but preserves settings and history
   */
  async disconnect(): Promise<void> {
    try {
      console.log("[AccountManager] Disconnecting account...");

      // Remove account from storage
      await this.storageManager.removeAccount();

      // Clear connected dApps
      await this.storageManager.setConnectedDapps({});

      console.log("[AccountManager] Account disconnected");
    } catch (error) {
      console.error("[AccountManager] Failed to disconnect:", error);
      throw error;
    }
  }

  /**
   * Update account information
   * @param updates - Partial account updates
   */
  async updateAccount(updates: Partial<Account>): Promise<void> {
    try {
      const account = await this.getAccount();

      if (!account) {
        throw new Error(ERROR_MESSAGES.NO_ACCOUNT);
      }

      // Merge updates
      const updatedAccount: Account = {
        ...account,
        ...updates,
      };

      await this.storageManager.setAccount(updatedAccount);

      console.log("[AccountManager] Account updated");
    } catch (error) {
      console.error("[AccountManager] Failed to update account:", error);
      throw error;
    }
  }

  /**
   * Update last authentication timestamp
   */
  async updateLastAuth(): Promise<void> {
    try {
      const account = await this.getAccount();

      if (account) {
        account.lastAuthAt = Date.now();
        await this.storageManager.setAccount(account);
      }
    } catch (error) {
      console.error("[AccountManager] Failed to update last auth:", error);
    }
  }

  /**
   * Get account creation timestamp
   * @returns Promise resolving to timestamp or null
   */
  async getAccountAge(): Promise<number | null> {
    const account = await this.getAccount();

    if (!account) {
      return null;
    }

    return Date.now() - account.createdAt;
  }
}
